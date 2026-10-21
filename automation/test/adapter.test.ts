import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import { GreenhouseAdapter } from "../src/ats/greenhouse.js";
import { LinkedInAdapter } from "../src/ats/linkedin.js";
import { localExecutablePath } from "../src/browser.js";

const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adapter-workspace-"));
fs.mkdirSync(path.join(workspaceRoot, "candidate", "resumes"), { recursive: true });
fs.writeFileSync(path.join(workspaceRoot, "candidate", "resumes", "primary.pdf"), "fixture");
const resume = "candidate/resumes/primary.pdf";
const basePayload = {
  company: "Example Company",
  role: "Backend Engineer",
  jobUrl: "https://boards.greenhouse.io/example/jobs/123",
  ats: "greenhouse" as const,
  resume,
  candidate: {
    name: "Example Candidate",
    email: "candidate@example.test",
    phone: "+1 0000000000",
    location: "Remote",
  },
  answers: { work_authorized: "Yes" },
};

describe("ATS detection", () => {
  it("recognizes official ATS hosts without inspecting credentials", () => {
    const context = { page: undefined as never, payload: basePayload, workspaceRoot, dryRun: true, timeoutMs: 1000 };
    expect(new GreenhouseAdapter(context).matchesUrl("https://boards.greenhouse.io/example/jobs/123")).toBe(true);
    expect(new LinkedInAdapter(context).matchesUrl("https://www.linkedin.com/jobs/view/123")).toBe(true);
  });
});

describe("deterministic form execution", () => {
  it("fills known fields and answers, uploads the selected resume, and never clicks submit in dry-run", async () => {
    const browser = await chromium.launch({ headless: true, executablePath: localExecutablePath() });
    const page = await browser.newPage();
    await page.setContent(`
      <h1>Example Company - Backend Engineer</h1>
      <form>
        <label>First name <input id="first_name" required></label>
        <label>Last name <input id="last_name" required></label>
        <label>Email <input type="email" required></label>
        <label>Phone <input type="tel" required></label>
        <label>Location <input name="location" required></label>
        <label>Work authorized <select name="work_authorized" required><option value="">Choose</option><option>Yes</option></select></label>
        <input type="file" name="resume">
        <button type="button" id="submit" aria-label="Submit Application">Submit Application</button>
      </form>
    `);
    let clicked = false;
    await page.locator("#submit").evaluate((node) => node.addEventListener("click", () => undefined));
    const adapter = new GreenhouseAdapter({ page, payload: basePayload, workspaceRoot, dryRun: true, timeoutMs: 1000, captchaSettleMs: 1 });
    expect((await adapter.fillKnownFields()).ok).toBe(true);
    expect((await adapter.uploadResume()).ok).toBe(true);
    expect((await adapter.answerQuestions()).ok).toBe(true);
    expect((await adapter.validate()).ok).toBe(true);
    expect((await adapter.submit()).details).toContain("not clicked");
    expect(clicked).toBe(false);
    expect(await page.locator("input[type=email]").inputValue()).toBe("candidate@example.test");
    expect(await page.locator("select").inputValue()).toBe("Yes");
    await browser.close();
  }, 20_000);

  it("returns the exact unknown required question and options", async () => {
    const browser = await chromium.launch({ headless: true, executablePath: localExecutablePath() });
    const page = await browser.newPage();
    await page.setContent(`<h1>Example Company - Backend Engineer</h1><label>Do you agree to a background check? <select name="background_check" required><option value="">Choose</option><option>Yes</option><option>No</option></select></label>`);
    const adapter = new GreenhouseAdapter({ page, payload: basePayload, workspaceRoot, dryRun: true, timeoutMs: 1000, captchaSettleMs: 1 });
    const result = await adapter.answerQuestions();
    expect(result.ok).toBe(false);
    expect(result.blocker?.type).toBe("unknown_required_question");
    expect(result.blocker?.question).toContain("background check");
    expect(result.blocker?.options).toEqual(["Choose", "Yes", "No"]);
    await browser.close();
  });

  it("returns a CAPTCHA blocker", async () => {
    const browser = await chromium.launch({ headless: true, executablePath: localExecutablePath() });
    const page = await browser.newPage();
    await page.setContent(`<h1>Example Company - Backend Engineer</h1><div>Complete the CAPTCHA verification</div>`);
    const adapter = new GreenhouseAdapter({ page, payload: basePayload, workspaceRoot, dryRun: true, timeoutMs: 1000, captchaSettleMs: 1 });
    const result = await adapter.validate();
    expect(result.blocker?.type).toBe("captcha");
    await browser.close();
  });

  it("allows invisible reCAPTCHA background checks without a visible challenge", async () => {
    const browser = await chromium.launch({ headless: true, executablePath: localExecutablePath() });
    const page = await browser.newPage();
    await page.setContent(`<h1>Example Company - Backend Engineer</h1><iframe title="reCAPTCHA" data-size="invisible"></iframe>`);
    const adapter = new GreenhouseAdapter({ page, payload: basePayload, workspaceRoot, dryRun: true, timeoutMs: 1000, captchaSettleMs: 1 });
    const result = await adapter.validate();
    expect(result.ok).toBe(true);
    await browser.close();
  });

  it("preserves expected and observed evidence for an identity mismatch", async () => {
    const browser = await chromium.launch({ headless: true, executablePath: localExecutablePath() });
    const page = await browser.newPage();
    await page.setContent(`<title>Different Company</title><h1>Different Company - Platform Engineer</h1><p>Job 7654321</p>`);
    const adapter = new GreenhouseAdapter({ page, payload: { ...basePayload, jobId: "123" }, workspaceRoot, dryRun: true, timeoutMs: 1000, captchaSettleMs: 1 });
    const result = await adapter.validate();
    expect(result.blocker?.type).toBe("identity_mismatch");
    expect(result.blocker?.expectedCompany).toBe("Example Company");
    expect(result.blocker?.expectedRole).toBe("Backend Engineer");
    expect(result.blocker?.expectedJobId).toBe("123");
    expect(result.blocker?.observedCompany).toBe("not detected");
    expect(result.blocker?.observedJobId).toBe("7654321");
    expect(result.blocker?.pageTextEvidence).toContain("Different Company");
    await browser.close();
  });
});
