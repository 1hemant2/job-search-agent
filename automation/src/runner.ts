import fs from "node:fs";
import path from "node:path";
import { createBrowserSession } from "./browser.js";
import { readPayloadFile, validateApplicationPayload, findDuplicate } from "./application-payload.js";
import { AshbyAdapter } from "./ats/ashby.js";
import { GenericAdapter } from "./ats/generic.js";
import { GreenhouseAdapter } from "./ats/greenhouse.js";
import { LeverAdapter } from "./ats/lever.js";
import { LinkedInAdapter } from "./ats/linkedin.js";
import { WorkdayAdapter } from "./ats/workday.js";
import { hasActiveCaptchaBlocker, recordCaptchaBlocker, resolveCaptchaBlocker } from "./captcha-state.js";
import { applicationBlocker, resultFor, withoutSecrets, blocker } from "./result.js";
import type { ApplicationPayload, AtsAdapter, AtsName, ExecutionOptions, ExecutionResult } from "./types.js";

export async function executeApplication(input: unknown, options: ExecutionOptions = {}): Promise<ExecutionResult> {
  const startedAt = Date.now();
  const workspaceRoot = options.workspaceRoot ?? path.resolve(process.cwd(), "..");
  const validation = validateApplicationPayload(input, workspaceRoot, options.dryRun ?? false);
  const payload = validation.payload;
  if (validation.errors.length) {
    return resultFor(payload, "failed", "failed", startedAt, { error: validation.errors.join("; ") });
  }

  const historyPath = options.historyPath ?? path.join(workspaceRoot, "application-history.md");
  const history = fs.existsSync(historyPath) ? fs.readFileSync(historyPath, "utf8") : "";
  const duplicate = findDuplicate(payload, history);
  if (duplicate) {
    if (options.resumeCaptcha) resolveCaptchaBlocker(workspaceRoot, payload);
    return resultFor(payload, "duplicate", "failed", startedAt, { blocker: applicationBlocker(payload, "duplicate", duplicate) });
  }

  const activeCaptchaQueued = hasActiveCaptchaBlocker(workspaceRoot, payload);
  if (!options.resumeCaptcha && activeCaptchaQueued) {
    return resultFor(payload, "blocked", "blocked_captcha", startedAt, {
      blocker: applicationBlocker(payload, "captcha", "CAPTCHA blocker already queued; resume only after human verification is completed", {
        url: payload.applicationUrl ?? payload.jobUrl,
      }),
    });
  }

  // A caller must explicitly opt in twice before a final submit click can occur:
  // dryRun must be false and allowSubmit must be true.
  const dryRun = options.dryRun === true || options.allowSubmit !== true;
  let browser;
  try {
    browser = await createBrowserSession({ ...options, workspaceRoot });
    const adapter = adapterFor(payload.ats, {
      page: browser.page,
      payload,
      workspaceRoot,
      dryRun,
      timeoutMs: options.timeoutMs ?? 15_000,
    });
    const targetUrl = payload.applicationUrl ?? payload.jobUrl;
    if (!adapter.matchesUrl(targetUrl) && payload.ats !== "generic") {
      return resultFor(payload, "failed", "failed", startedAt, { error: `ATS ${payload.ats} does not match target URL ${targetUrl}` });
    }
    const opened = await adapter.openApplication();
    if (!opened.ok) return resultFor(payload, "blocked", "blocked", startedAt, { blocker: opened.blocker });
    if (!(await adapter.detect())) return resultFor(payload, "failed", "failed", startedAt, { error: `ATS ${payload.ats} was not detected on ${browser.page.url()}` });

    const captcha = await adapter.handleCaptcha();
    if (!captcha.ok && captcha.blocker?.type === "captcha") return recordCaptchaResult(payload, workspaceRoot, startedAt, captcha.blocker, "application_opened");
    if (options.resumeCaptcha && activeCaptchaQueued && captcha.ok) resolveCaptchaBlocker(workspaceRoot, payload);

    if (await adapter.detectAssessment()) return resultFor(payload, "assessment", "assessment", startedAt, { blocker: blocker("unsupported_form", "Candidate assessment detected; executor will not complete it", { url: browser.page.url() }) });

    const phases: Array<[string, () => Promise<Awaited<ReturnType<AtsAdapter["fillKnownFields"]>> >]> = [
      ["profile_filled", () => adapter.fillKnownFields()],
      ["resume_uploaded", () => adapter.uploadResume()],
      ["questions_resolved", () => adapter.answerQuestions()],
      ["review_ready", () => adapter.validate()],
    ];
    for (const [stepName, executePhase] of phases) {
      const step = await executePhase();
      if (!step.ok && step.blocker?.type === "captcha") return recordCaptchaResult(payload, workspaceRoot, startedAt, step.blocker, stepName);
      if (!step.ok) return resultFor(payload, "blocked", "blocked", startedAt, { blocker: step.blocker });
    }

    const submit = await adapter.submit();
    if (!submit.ok && submit.blocker?.type === "captcha") return recordCaptchaResult(payload, workspaceRoot, startedAt, submit.blocker, "review_ready");
    if (!submit.ok) return resultFor(payload, "blocked", "blocked", startedAt, { blocker: submit.blocker });
    if (dryRun) return resultFor(payload, "dry_run", "prepared", startedAt, { dryRun: true, submissionEvidence: submit.details });

    const verified = await adapter.verifySubmission();
    if (!verified.ok) return resultFor(payload, "failed", "failed", startedAt, { blocker: verified.blocker });
    if (options.resumeCaptcha) resolveCaptchaBlocker(workspaceRoot, payload);
    return resultFor(payload, "submitted", "submitted", startedAt, { submissionEvidence: verified.details });
  } catch (error) {
    return resultFor(payload, "failed", "failed", startedAt, { error: withoutSecrets(error) });
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

function recordCaptchaResult(
  payload: ApplicationPayload,
  workspaceRoot: string,
  startedAt: number,
  detected: NonNullable<Awaited<ReturnType<AtsAdapter["handleCaptcha"]>>["blocker"]>,
  workflowStep: string,
): ExecutionResult {
  const checkpoint = {
    workflowStep,
    fieldsCompleted: fieldsCompletedThrough(workflowStep),
    unresolvedQuestions: detected.question ? [detected.question] : [],
  };
  try {
    recordCaptchaBlocker(workspaceRoot, payload, checkpoint);
  } catch (error) {
    // The application remains blocked even if local bookkeeping is unavailable.
    detected = { ...detected, message: `${detected.message}; local CAPTCHA state could not be persisted: ${withoutSecrets(error)}` };
  }
  return resultFor(payload, "blocked", "blocked_captcha", startedAt, {
    blocker: applicationBlocker(payload, "captcha", detected.message, {
      url: detected.url ?? payload.applicationUrl ?? payload.jobUrl,
      fieldKey: detected.fieldKey,
      question: detected.question,
      options: detected.options,
    }),
  });
}

function fieldsCompletedThrough(workflowStep: string): string[] {
  const steps: Record<string, string[]> = {
    application_opened: [],
    profile_filled: ["candidate_fields"],
    resume_uploaded: ["candidate_fields", "resume_upload"],
    questions_resolved: ["candidate_fields", "resume_upload", "prepared_questions"],
    review_ready: ["candidate_fields", "resume_upload", "prepared_questions", "review_validation"],
  };
  return steps[workflowStep] ?? [];
}

function adapterFor(ats: AtsName, context: ConstructorParameters<typeof LinkedInAdapter>[0]): AtsAdapter {
  switch (ats) {
    case "linkedin": return new LinkedInAdapter(context);
    case "workday": return new WorkdayAdapter(context);
    case "greenhouse": return new GreenhouseAdapter(context);
    case "lever": return new LeverAdapter(context);
    case "ashby": return new AshbyAdapter(context);
    default: return new GenericAdapter(context);
  }
}

function parseArgs(argv: string[]): { payloadPath?: string; dryRun: boolean; allowSubmit: boolean; headless: boolean; profileDir?: string; resumeCaptcha: boolean } {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") args.set(arg, true);
    else if (arg === "--allow-submit") args.set(arg, true);
    else if (arg === "--resume-captcha") args.set(arg, true);
    else if (arg === "--headful") args.set("--headless", false);
    else if (arg.startsWith("--") && argv[index + 1] && !argv[index + 1].startsWith("--")) args.set(arg, argv[++index]);
  }
  return {
    payloadPath: typeof args.get("--payload") === "string" ? args.get("--payload") as string : undefined,
    dryRun: args.get("--dry-run") === true || process.env.DRY_RUN?.toLowerCase() === "true" || args.get("--allow-submit") !== true,
    allowSubmit: args.get("--allow-submit") === true,
    headless: args.get("--headless") !== false,
    profileDir: typeof args.get("--profile-dir") === "string" ? args.get("--profile-dir") as string : undefined,
    resumeCaptcha: args.get("--resume-captcha") === true,
  };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.payloadPath) {
    console.error("Usage: npm run execute -- --payload path\\to\\payload.json [--dry-run|--allow-submit] [--resume-captcha] [--headful]");
    process.exitCode = 2;
  } else {
    const payload = readPayloadFile(path.resolve(args.payloadPath));
    const result = await executeApplication(payload, { ...args, workspaceRoot: path.resolve(process.cwd(), "..") });
    console.log(JSON.stringify(result, null, 2));
    if (["failed", "blocked", "assessment"].includes(result.status)) process.exitCode = 1;
  }
}
