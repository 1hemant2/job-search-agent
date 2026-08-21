import fs from "node:fs";
import type { Locator, Page } from "playwright";
import { isAllowedNavigation, resumeAbsolutePath } from "../application-payload.js";
import { safeGoto } from "../browser.js";
import { blocker } from "../result.js";
import type {
  AdapterContext,
  AdapterStepResult,
  ApplicationPayload,
  AtsAdapter,
  AtsName,
  AnswerValue,
  Blocker,
} from "../types.js";

const CAPTCHA_CHALLENGE_TEXT_RE = /(?:complete|solve|verify|verification|challenge|required|human|robot)[^.!?\n]{0,100}(?:captcha|recaptcha|hcaptcha|turnstile)|(?:captcha|recaptcha|hcaptcha|turnstile)[^.!?\n]{0,100}(?:complete|solve|verify|verification|challenge|required|human|robot)/i;
const AUTH_RE = /sign\s*in|log\s*in|create an account|verify your email|two[- ]factor|multi[- ]factor/i;
const ASSESSMENT_RE = /technical assessment|coding assessment|take[- ]home|personality assessment|ai interview|online test/i;

export abstract class BaseAtsAdapter implements AtsAdapter {
  abstract readonly name: AtsName;
  protected readonly page: Page;
  protected readonly payload: ApplicationPayload;
  protected readonly workspaceRoot: string;
  protected readonly dryRun: boolean;
  protected readonly timeoutMs: number;
  protected readonly captchaSettleMs: number;

  constructor(context: AdapterContext) {
    this.page = context.page;
    this.payload = context.payload;
    this.workspaceRoot = context.workspaceRoot;
    this.dryRun = context.dryRun;
    this.timeoutMs = context.timeoutMs;
    this.captchaSettleMs = context.captchaSettleMs ?? 750;
  }

  abstract matchesUrl(url: string): boolean;

  async detect(): Promise<boolean> {
    return this.matchesUrl(this.page.url());
  }

  async handleCaptcha(): Promise<AdapterStepResult> {
    if (!(await this.hasCaptchaChallenge())) return { ok: true, details: "no CAPTCHA challenge detected" };

    // Give a normal page verification a short, bounded opportunity to finish.
    // No control is clicked and no token or challenge value is inspected.
    const settleMs = this.captchaSettleMs;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await this.page.waitForTimeout(settleMs);
      if (!(await this.hasCaptchaChallenge())) return { ok: true, details: "CAPTCHA challenge cleared naturally" };
    }
    return {
      ok: false,
      blocker: blocker("captcha", "Human CAPTCHA completion required; automation will not solve or bypass it", { url: this.page.url() }),
    };
  }

  async openApplication(): Promise<AdapterStepResult> {
    const targetUrl = this.payload.applicationUrl ?? this.payload.jobUrl;
    try {
      await safeGoto(this.page, this.payload, targetUrl);
      return { ok: true, details: `opened ${this.page.url()}` };
    } catch (error) {
      return { ok: false, blocker: blocker("unsafe_domain", error instanceof Error ? error.message : String(error), { url: targetUrl }) };
    }
  }

  async fillKnownFields(): Promise<AdapterStepResult> {
    const [firstName, ...lastParts] = this.payload.candidate.name.trim().split(/\s+/);
    const lastName = lastParts.join(" ");
    const values: Array<{ value: string; labels: string[]; selectors: string[] }> = [
      { value: firstName, labels: ["first name", "given name"], selectors: ["input[name*='first' i]", "input[id*='first' i]"] },
      { value: lastName, labels: ["last name", "surname", "family name"], selectors: ["input[name*='last' i]", "input[id*='last' i]"] },
      { value: this.payload.candidate.name, labels: ["full name", "name"], selectors: ["input[name='name' i]", "input[id='name' i]"] },
      { value: this.payload.candidate.email, labels: ["email", "email address"], selectors: ["input[type='email']", "input[name*='email' i]"] },
      { value: this.payload.candidate.phone, labels: ["phone", "phone number", "mobile"], selectors: ["input[type='tel']", "input[name*='phone' i]", "input[name*='mobile' i]"] },
      { value: this.payload.candidate.location, labels: ["current location", "location", "city"], selectors: ["input[name*='location' i]", "input[name*='city' i]"] },
      { value: this.payload.candidate.linkedin ?? "", labels: ["linkedin"], selectors: ["input[name*='linkedin' i]", "input[id*='linkedin' i]"] },
      { value: this.payload.candidate.github ?? "", labels: ["github"], selectors: ["input[name*='github' i]", "input[id*='github' i]"] },
      { value: this.payload.candidate.portfolio ?? "", labels: ["portfolio", "website"], selectors: ["input[name*='portfolio' i]", "input[name*='website' i]"] },
    ];

    for (const item of values) {
      if (!item.value) continue;
      await this.fillFirst(item.labels, item.selectors, item.value);
    }

    const education = this.payload.candidate.education;
    if (education) {
      const educationValues = [
        { value: education.institution, labels: ["school", "university", "college", "institution"], selectors: ["input[name*='school' i]", "input[name*='university' i]"] },
        { value: education.degree, labels: ["degree"], selectors: ["input[name*='degree' i]"] },
        { value: education.field, labels: ["field of study", "discipline", "major"], selectors: ["input[name*='field' i]", "input[name*='major' i]"] },
        { value: education.startDate, labels: ["education start date", "start date"], selectors: ["input[name*='education_start' i]"] },
        { value: education.endDate, labels: ["education end date", "graduation date", "end date"], selectors: ["input[name*='education_end' i]", "input[name*='graduation' i]"] },
      ];
      for (const item of educationValues) if (item.value) await this.fillFirst(item.labels, item.selectors, item.value);
    }

    const employment = this.payload.candidate.employment?.[0];
    if (employment) {
      const employmentValues = [
        { value: employment.company, labels: ["employer", "company", "organization"], selectors: ["input[name*='employer' i]", "input[name*='company' i]"] },
        { value: employment.title, labels: ["job title", "title", "position"], selectors: ["input[name*='title' i]", "input[name*='position' i]"] },
        { value: employment.startDate, labels: ["employment start date", "start date"], selectors: ["input[name*='employment_start' i]"] },
        { value: employment.endDate, labels: ["employment end date", "end date"], selectors: ["input[name*='employment_end' i]"] },
      ];
      for (const item of employmentValues) if (item.value) await this.fillFirst(item.labels, item.selectors, item.value);
    }

    return { ok: true, details: "known candidate fields filled where matching controls were present" };
  }

  async uploadResume(): Promise<AdapterStepResult> {
    const resume = resumeAbsolutePath(this.payload, this.workspaceRoot);
    if (!fs.existsSync(resume)) return { ok: false, blocker: blocker("resume_upload", "Selected resume file does not exist", { fieldKey: "resume" }) };
    const input = this.page.locator("input[type='file']").first();
    if (await input.count() === 0) return { ok: true, details: "no resume upload control present" };
    try {
      await input.setInputFiles(resume);
      return { ok: true, details: "resume uploaded" };
    } catch (error) {
      return { ok: false, blocker: blocker("resume_upload", `Resume upload failed: ${error instanceof Error ? error.message : String(error)}`, { fieldKey: "resume" }) };
    }
  }

  async answerQuestions(): Promise<AdapterStepResult> {
    const controls = this.page.locator("input, select, textarea");
    const count = await controls.count();
    for (let index = 0; index < count; index += 1) {
      const control = controls.nth(index);
      if (!(await control.isVisible().catch(() => false))) continue;
      if (await this.isHiddenBackingControl(control)) continue;
      if (await this.isAuthenticationControl(control)) {
        return { ok: false, blocker: blocker("authentication", "Authentication or verification is required before form execution", { url: this.page.url() }) };
      }
      const required = await control.evaluate((node) => node.hasAttribute("required"));
      const label = await this.controlLabel(control);
      const key = await this.controlKey(control, label);
      const answer = this.findAnswer(key, label);
      if (answer !== undefined) {
        if (!(await this.isSatisfied(control))) await this.fillControl(control, answer);
        continue;
      }
      if (!required) continue;
      if (await this.isSatisfied(control)) continue;
      const options = await this.optionsFor(control);
      return {
        ok: false,
        blocker: blocker("unknown_required_question", "Required question is not present in the prepared payload", {
          question: label || key || "Unnamed required field",
          options,
          fieldKey: key || label,
          url: this.page.url(),
        }),
      };
    }
    return { ok: true, details: "required questions resolved from payload" };
  }

  async validate(): Promise<AdapterStepResult> {
    const url = this.page.url();
    // Unit/fixture pages may remain at about:blank after setContent. The real
    // runner always navigates through safeGoto before calling validate().
    if (url !== "about:blank" && !isAllowedNavigation(this.payload, url)) return { ok: false, blocker: blocker("unsafe_domain", "Application page is outside the allowlist", { url }) };
    const body = await this.page.locator("body").innerText().catch(() => "");
    const captcha = await this.handleCaptcha();
    if (!captcha.ok) return captcha;
    if (AUTH_RE.test(body) && !(await this.page.locator("input, select, textarea").count())) {
      return { ok: false, blocker: blocker("authentication", "Authentication is required before the application can be filled", { url }) };
    }
    const identity = `${this.payload.company} ${this.payload.role}`.trim().toLowerCase();
    const pageTitle = await this.page.title().catch(() => "");
    const titleAndBody = `${pageTitle} ${body}`.toLowerCase();
    const companyObserved = identityEvidence(this.payload.company, titleAndBody);
    const roleObserved = identityEvidence(this.payload.role, titleAndBody);
    if (!companyObserved && !roleObserved) {
      const observedJobId = /\b(?:[A-Z]\d{2}-\d{4}|\d{7,})\b/i.exec(`${url} ${body}`)?.[0];
      return {
        ok: false,
        blocker: blocker("identity_mismatch", "Company or role identity was not found on the application page", {
          url,
          expectedCompany: this.payload.company,
          expectedRole: this.payload.role,
          expectedJobId: this.payload.jobId,
          observedCompany: companyObserved ? this.payload.company : "not detected",
          observedRole: roleObserved ? this.payload.role : "not detected",
          observedJobId,
          pageTitle,
          pageTextEvidence: body.replace(/\s+/g, " ").trim().slice(0, 500),
        }),
      };
    }
    return { ok: true, details: "domain, identity, CAPTCHA, and material form checks passed" };
  }

  async detectAssessment(): Promise<boolean> {
    const body = await this.page.locator("body").innerText().catch(() => "");
    return ASSESSMENT_RE.test(body);
  }

  async submit(): Promise<AdapterStepResult> {
    if (this.dryRun) return { ok: true, details: "dry-run: final submit control was not clicked" };
    const button = await this.finalSubmitControl();
    if (!button) return { ok: false, blocker: blocker("unsupported_form", "No adapter-owned final submit control was found", { url: this.page.url() }) };
    try {
      await button.click();
      return { ok: true, details: "final submit control clicked" };
    } catch (error) {
      return { ok: false, blocker: blocker("browser", `Final submit action failed: ${error instanceof Error ? error.message : String(error)}`, { url: this.page.url() }) };
    }
  }

  async verifySubmission(): Promise<AdapterStepResult> {
    await this.page.waitForLoadState("domcontentloaded", { timeout: this.timeoutMs }).catch(() => undefined);
    const body = await this.page.locator("body").innerText().catch(() => "");
    const evidence = /application (submitted|received)|thank you for applying|successfully submitted|application complete|your application has been sent/i.exec(body);
    if (evidence) return { ok: true, details: evidence[0] };
    return { ok: false, blocker: blocker("submission_not_verified", "The application site did not expose a recognized submission confirmation", { url: this.page.url() }) };
  }

  protected abstract finalSubmitControl(): Promise<Locator | undefined>;

  private async hasCaptchaChallenge(): Promise<boolean> {
    const body = await this.page.locator("body").innerText().catch(() => "");
    if (CAPTCHA_CHALLENGE_TEXT_RE.test(body)) return true;
    const selectors = [
      "iframe[src*='captcha' i]",
      "iframe[title*='captcha' i]",
      "[id*='captcha' i]",
      "[class*='captcha' i]",
      "[data-sitekey]",
    ];
    for (const selector of selectors) {
      const controls = this.page.locator(selector);
      const count = await controls.count();
      for (let index = 0; index < count; index += 1) {
        const control = controls.nth(index);
        const metadata = await control.evaluate((node) => ({
          src: node.getAttribute("src") ?? "",
          className: typeof node.className === "string" ? node.className : "",
          size: node.getAttribute("data-size") ?? "",
        })).catch(() => ({ src: "", className: "", size: "" }));
        const isInvisibleRecaptcha = /size=invisible/i.test(metadata.src) || /\binvisible\b/i.test(metadata.size);
        const isBackgroundBadge = /(?:^|\s)grecaptcha-(?:badge|logo|error)(?:\s|$)/i.test(metadata.className);
        if (isInvisibleRecaptcha || isBackgroundBadge) continue;
        if (await control.isVisible().catch(() => false)) return true;
      }
    }
    return false;
  }

  protected async fillFirst(labels: string[], selectors: string[], value: string): Promise<boolean> {
    // Prefer structural input selectors before accessible-label lookup. Some
    // ATS pages expose unrelated links (for example, "Share via email") with
    // the same accessible label as a real form field.
    for (const selector of selectors) {
      const locator = this.page.locator(selector).first();
      if (await locator.count() && await locator.isVisible().catch(() => false)) {
        await locator.fill(value);
        return true;
      }
    }
    for (const label of labels) {
      const locator = this.page.getByLabel(label, { exact: false }).first();
      if (await locator.count() && await locator.isVisible().catch(() => false)) {
        const tag = await locator.evaluate((node) => node.tagName.toLowerCase()).catch(() => "");
        if (!["input", "textarea", "select"].includes(tag)) continue;
        await locator.fill(value);
        return true;
      }
    }
    return false;
  }

  private async isSatisfied(control: Locator): Promise<boolean> {
    const tag = await control.evaluate((node) => node.tagName.toLowerCase());
    if (tag === "select") return Boolean(await control.inputValue().catch(() => ""));
    const type = (await control.getAttribute("type"))?.toLowerCase();
    if (type === "checkbox" || type === "radio") return await control.isChecked().catch(() => false);
    return Boolean(await control.inputValue().catch(() => ""));
  }

  private async isAuthenticationControl(control: Locator): Promise<boolean> {
    const text = `${await control.getAttribute("name") ?? ""} ${await control.getAttribute("id") ?? ""} ${await control.getAttribute("placeholder") ?? ""}`;
    return /password|otp|one[- ]time|verification/i.test(text);
  }

  private async controlLabel(control: Locator): Promise<string> {
    return control.evaluate((node) => {
      const id = node.getAttribute("id");
      const associated = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      const labelledBy = (node.getAttribute("aria-labelledby") ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .map((reference) => document.getElementById(reference)?.textContent ?? "")
        .join(" ");
      const parent = node.closest("label");
      const fieldset = node.closest("fieldset");
      return (associated?.textContent || labelledBy || parent?.textContent || fieldset?.querySelector("legend")?.textContent || node.getAttribute("aria-label") || node.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim();
    }).catch(() => "");
  }

  private async controlKey(control: Locator, label: string): Promise<string> {
    const attributes = [await control.getAttribute("name"), await control.getAttribute("id"), await control.getAttribute("data-testid")].filter(Boolean);
    return attributes[0] ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  private findAnswer(key: string, label: string): AnswerValue | undefined {
    const entries = Object.entries(this.payload.answers);
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const normalizedLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const found = entries.find(([answerKey]) => {
      const candidate = answerKey.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      return candidate === normalizedKey || candidate === normalizedLabel;
    });
    return found?.[1];
  }

  private async optionsFor(control: Locator): Promise<string[]> {
    const tag = await control.evaluate((node) => node.tagName.toLowerCase()).catch(() => "");
    if (tag === "select") return await control.locator("option").allTextContents();
    return [];
  }

  private async fillControl(control: Locator, answer: AnswerValue): Promise<void> {
    const tag = await control.evaluate((node) => node.tagName.toLowerCase());
    const type = (await control.getAttribute("type"))?.toLowerCase();
    const role = (await control.getAttribute("role"))?.toLowerCase();
    if (type === "checkbox" || type === "radio") {
      if (Boolean(answer) !== await control.isChecked().catch(() => false)) await control.check({ force: true });
    } else if (tag === "select") {
      if (typeof answer === "string") await control.selectOption({ label: answer }).catch(() => control.selectOption(answer));
      else await control.selectOption(String(answer));
    } else if (role === "combobox") {
      await control.click();
      await control.fill(String(answer ?? ""));
      const option = this.page.getByRole("option", { name: String(answer ?? ""), exact: false }).first();
      if (await option.count() && await option.isVisible().catch(() => false)) await option.click();
      else await control.press("Enter").catch(() => undefined);
    } else {
      await control.fill(String(answer ?? ""));
    }
  }

  private async isHiddenBackingControl(control: Locator): Promise<boolean> {
    const ariaHidden = (await control.getAttribute("aria-hidden"))?.toLowerCase() === "true";
    const tabIndex = await control.getAttribute("tabindex");
    const className = await control.getAttribute("class") ?? "";
    return ariaHidden || (tabIndex === "-1" && /requiredinput/i.test(className));
  }
}

function identityEvidence(expected: string, pageText: string): boolean {
  const normalizedExpected = expected.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalizedExpected) return false;
  if (pageText.includes(normalizedExpected)) return true;
  const tokens = normalizedExpected.split(" ").filter((token) => token.length >= 4);
  if (!tokens.length) return false;
  const matched = tokens.filter((token) => pageText.includes(token)).length;
  return matched >= Math.ceil(tokens.length * 0.66);
}
