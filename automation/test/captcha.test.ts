import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { executeApplication } from "../src/runner.js";
import { hasActiveCaptchaBlocker, recordCaptchaBlocker, resolveCaptchaBlocker } from "../src/captcha-state.js";

const workspaceRoot = path.resolve(process.cwd(), "..");

function payload(root: string, url: string, company: string, role: string) {
  return {
    company,
    role,
    jobUrl: url,
    ats: "generic" as const,
    resume: "resumes/test-resume.pdf",
    candidate: { name: "Test Candidate", email: "candidate@example.test", phone: "+91 0000000000", location: "Bengaluru" },
    answers: {},
    workspaceRoot: root,
  };
}

describe("CAPTCHA queue persistence", () => {
  it("is idempotent, stores only non-secret resume/application metadata, and resolves", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "captcha-queue-"));
    const item = payload(root, "https://jobs.example.test/apply/1", "Example Company", "Backend Engineer");
    fs.mkdirSync(path.join(root, "resumes"), { recursive: true });
    fs.writeFileSync(path.join(root, "resumes", "test-resume.pdf"), "fixture");

    const first = recordCaptchaBlocker(root, item, { workflowStep: "profile_filled", fieldsCompleted: ["candidate_fields"] });
    const second = recordCaptchaBlocker(root, item, { workflowStep: "profile_filled", fieldsCompleted: ["candidate_fields"] });
    const queue = fs.readFileSync(path.join(root, "candidate", "human-input-queue.md"), "utf8");
    const state = fs.readFileSync(path.join(root, "state", "run-state.md"), "utf8");

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect((queue.match(/captcha-queue-key:/g) ?? []).length).toBe(1);
    expect(hasActiveCaptchaBlocker(root, item)).toBe(true);
    expect(queue).not.toContain("candidate@example.test");
    expect(queue).not.toMatch(/password|token|cookie|otp|mfa/i);
    expect(state).toContain("blocked_captcha");

    expect(resolveCaptchaBlocker(root, item)).toBe(true);
    expect(hasActiveCaptchaBlocker(root, item)).toBe(false);
    expect(fs.readFileSync(path.join(root, "candidate", "human-input-queue.md"), "utf8")).toContain("resolved_captcha");
  });
});

describe("application-level CAPTCHA routing", () => {
  it("returns blocked_captcha for Job A and still executes Job B", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "captcha-runner-"));
    fs.mkdirSync(path.join(root, "resumes"), { recursive: true });
    fs.writeFileSync(path.join(root, "resumes", "test-resume.pdf"), "fixture");
    const server = http.createServer((request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      if (request.url?.includes("captcha")) {
        response.end("<h1>Captcha Company — Backend Engineer</h1><div>Complete CAPTCHA verification</div>");
      } else {
        response.end("<h1>Clear Company — Backend Engineer</h1><form><label>Email <input type='email' required></label><button type='button' aria-label='Submit Application'>Submit Application</button></form>");
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not bind");

    const captchaResult = await executeApplication(payload(root, `http://127.0.0.1:${address.port}/captcha`, "Captcha Company", "Backend Engineer"), {
      workspaceRoot: root,
      dryRun: true,
      profileDir: path.join(root, ".profile-captcha"),
      timeoutMs: 2_000,
    });
    const repeatedResult = await executeApplication(payload(root, `http://127.0.0.1:${address.port}/captcha`, "Captcha Company", "Backend Engineer"), {
      workspaceRoot: root,
      dryRun: true,
      profileDir: path.join(root, ".profile-captcha-repeat"),
      timeoutMs: 2_000,
    });
    const clearResult = await executeApplication(payload(root, `http://127.0.0.1:${address.port}/clear`, "Clear Company", "Backend Engineer"), {
      workspaceRoot: root,
      dryRun: true,
      profileDir: path.join(root, ".profile-clear"),
      timeoutMs: 2_000,
    });
    server.close();

    expect(captchaResult.status).toBe("blocked");
    expect(captchaResult.lifecycle).toBe("blocked_captcha");
    expect(captchaResult.blocker?.type).toBe("captcha");
    expect(repeatedResult.lifecycle).toBe("blocked_captcha");
    expect(repeatedResult.blocker?.message).toContain("already queued");
    expect(clearResult.status).toBe("dry_run");
    expect(fs.readFileSync(path.join(root, "candidate", "human-input-queue.md"), "utf8")).toContain("Captcha Company");
  }, 30_000);
});
