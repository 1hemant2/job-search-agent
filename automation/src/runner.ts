import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createBrowserSession, type BrowserSession } from "./browser.js";
import { readPayloadFile, validateApplicationPayload, findDuplicate } from "./application-payload.js";
import { AshbyAdapter } from "./ats/ashby.js";
import { GenericAdapter } from "./ats/generic.js";
import { GreenhouseAdapter } from "./ats/greenhouse.js";
import { LeverAdapter } from "./ats/lever.js";
import { LinkedInAdapter } from "./ats/linkedin.js";
import { WorkdayAdapter } from "./ats/workday.js";
import { hasActiveCaptchaBlocker, recordCaptchaBlocker, resolveCaptchaBlocker } from "./captcha-state.js";
import { DiscoveryLedger } from "./discovery-ledger.js";
import { canonicalOpportunityId } from "./opportunity.js";
import { applicationBlocker, resultFor, withoutSecrets, blocker } from "./result.js";
import type { ApplicationPayload, AtsAdapter, AtsName, Blocker, ExecutionOptions, ExecutionResult, ExecutorTelemetry } from "./types.js";

export async function executeApplication(input: unknown, options: ExecutionOptions = {}): Promise<ExecutionResult> {
  const startedAt = Date.now();
  const workspaceRoot = options.workspaceRoot ?? path.resolve(process.cwd(), "..");
  const validation = validateApplicationPayload(input, workspaceRoot, options.dryRun ?? false);
  const payload = validation.payload;
  let browser: BrowserSession | undefined;
  let currentPhase = "validation";
  const startingUrl = payload.applicationUrl ?? payload.jobUrl;
  const ledger = options.runId ? new DiscoveryLedger(workspaceRoot, options.runId) : undefined;
  const finish = async (
    status: ExecutionResult["status"],
    lifecycle: ExecutionResult["lifecycle"],
    extras: Partial<ExecutionResult> = {},
  ): Promise<ExecutionResult> => {
    const telemetry: ExecutorTelemetry = {
      executor: "local-playwright",
      atsAdapter: payload.ats,
      startingUrl,
      finalUrl: browser?.page.url(),
      pageTitle: await browser?.page.title().catch(() => undefined),
      currentPhase,
      visibleEvidence: extras.submissionEvidence ?? extras.blocker?.message ?? extras.error,
    };
    const result = resultFor(payload, status, lifecycle, startedAt, { ...extras, executorTelemetry: telemetry });
    if (ledger) {
      const executorBlocker = result.blocker;
      ledger.appendExecutor({
        run_id: options.runId!,
        timestamp: new Date().toISOString(),
        company: payload.company,
        role: payload.role,
        job_url: payload.jobUrl,
        normalized_job_id: payload.opportunityId ?? canonicalOpportunityId({ source: payload.ats, company: payload.company, role: payload.role, jobUrl: payload.jobUrl, jobId: payload.jobId, applicationUrl: payload.applicationUrl }),
        opportunity_id: payload.opportunityId,
        executor: "local-playwright",
        ats_adapter: payload.ats,
        starting_url: telemetry.startingUrl,
        final_url: telemetry.finalUrl,
        page_title: telemetry.pageTitle,
        current_phase: currentPhase,
        result_status: result.status,
        lifecycle: result.lifecycle,
        blocker_type: executorBlocker?.type,
        visible_evidence: telemetry.visibleEvidence,
        expected_company: executorBlocker?.expectedCompany,
        expected_role: executorBlocker?.expectedRole,
        expected_job_id: executorBlocker?.expectedJobId,
        observed_company: executorBlocker?.observedCompany,
        observed_role: executorBlocker?.observedRole,
        observed_job_id: executorBlocker?.observedJobId,
        raw_result: result,
      });
    }
    return result;
  };
  if (validation.errors.length) {
    return finish("failed", "failed", { error: validation.errors.join("; ") });
  }

  if (payload.applicationChannel === "external_application" && !options.allowExternalAutomation) {
    return finish("blocked", "blocked", {
      blocker: applicationBlocker(payload, "unsupported_form", "Local-runner external execution requires the explicit allow-external policy flag"),
    });
  }

  const historyPath = options.historyPath ?? path.join(workspaceRoot, "application-history.md");
  const history = fs.existsSync(historyPath) ? fs.readFileSync(historyPath, "utf8") : "";
  const duplicate = findDuplicate(payload, history);
  if (duplicate) {
    if (options.resumeCaptcha) resolveCaptchaBlocker(workspaceRoot, payload);
    return finish("duplicate", "failed", { blocker: applicationBlocker(payload, "duplicate", duplicate) });
  }

  const activeCaptchaQueued = hasActiveCaptchaBlocker(workspaceRoot, payload);
  if (!options.resumeCaptcha && activeCaptchaQueued) {
    return finish("blocked", "blocked_captcha", {
      blocker: applicationBlocker(payload, "captcha", "CAPTCHA blocker already queued; resume only after human verification is completed", {
        url: payload.applicationUrl ?? payload.jobUrl,
      }),
    });
  }

  // A caller must explicitly opt in twice before a final submit click can occur:
  // dryRun must be false and allowSubmit must be true.
  const dryRun = options.dryRun === true || options.allowSubmit !== true;
  try {
    currentPhase = "browser_launch";
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
      currentPhase = "routing";
      return finish("failed", "failed", { error: `ATS ${payload.ats} does not match target URL ${targetUrl}` });
    }
    currentPhase = "application_opening";
    const opened = await adapter.openApplication();
    if (!opened.ok) return finish("blocked", "blocked", { blocker: opened.blocker });
    currentPhase = "application_opened";
    if (!(await adapter.detect())) return finish("failed", "failed", { error: `ATS ${payload.ats} was not detected on ${browser.page.url()}` });

    currentPhase = "captcha_check";
    const captcha = await adapter.handleCaptcha();
    if (!captcha.ok && captcha.blocker?.type === "captcha") {
      const captchaBlocker = recordCaptchaResult(payload, workspaceRoot, captcha.blocker, "application_opened");
      return finish("blocked", "blocked_captcha", { blocker: captchaBlocker });
    }
    if (options.resumeCaptcha && activeCaptchaQueued && captcha.ok) resolveCaptchaBlocker(workspaceRoot, payload);

    currentPhase = "assessment_check";
    if (await adapter.detectAssessment()) return finish("assessment", "assessment", { blocker: blocker("unsupported_form", "Candidate assessment detected; executor will not complete it", { url: browser.page.url() }) });

    const phases: Array<[string, () => Promise<Awaited<ReturnType<AtsAdapter["fillKnownFields"]>> >]> = [
      ["profile_filled", () => adapter.fillKnownFields()],
      ["resume_uploaded", () => adapter.uploadResume()],
      ["questions_resolved", () => adapter.answerQuestions()],
      ["review_ready", () => adapter.validate()],
    ];
    for (const [stepName, executePhase] of phases) {
      currentPhase = stepName;
      const step = await executePhase();
      if (!step.ok && step.blocker?.type === "captcha") {
        const captchaBlocker = recordCaptchaResult(payload, workspaceRoot, step.blocker, stepName);
        return finish("blocked", "blocked_captcha", { blocker: captchaBlocker });
      }
      if (!step.ok) return finish("blocked", "blocked", { blocker: step.blocker });
    }

    currentPhase = "submit";
    const submit = await adapter.submit();
    if (!submit.ok && submit.blocker?.type === "captcha") {
      const captchaBlocker = recordCaptchaResult(payload, workspaceRoot, submit.blocker, "review_ready");
      return finish("blocked", "blocked_captcha", { blocker: captchaBlocker });
    }
    if (!submit.ok) return finish("blocked", "blocked", { blocker: submit.blocker });
    if (dryRun) return finish("dry_run", "prepared", { dryRun: true, submissionEvidence: submit.details });

    currentPhase = "verify_submission";
    const verified = await adapter.verifySubmission();
    if (!verified.ok) return finish("failed", "failed", { blocker: verified.blocker });
    if (options.resumeCaptcha) resolveCaptchaBlocker(workspaceRoot, payload);
    return finish("submitted", "submitted", { submissionEvidence: verified.details });
  } catch (error) {
    currentPhase = "exception";
    return finish("failed", "failed", { error: withoutSecrets(error) });
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

function recordCaptchaResult(
  payload: ApplicationPayload,
  workspaceRoot: string,
  detected: NonNullable<Awaited<ReturnType<AtsAdapter["handleCaptcha"]>>["blocker"]>,
  workflowStep: string,
): Blocker {
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
  return applicationBlocker(payload, "captcha", detected.message, {
    url: detected.url ?? payload.applicationUrl ?? payload.jobUrl,
    fieldKey: detected.fieldKey,
    question: detected.question,
    options: detected.options,
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

function parseArgs(argv: string[]): { payloadPath?: string; dryRun: boolean; allowSubmit: boolean; allowExternalAutomation: boolean; headless: boolean; profileDir?: string; resumeCaptcha: boolean; runId?: string } {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") args.set(arg, true);
    else if (arg === "--allow-submit") args.set(arg, true);
    else if (arg === "--allow-external") args.set(arg, true);
    else if (arg === "--resume-captcha") args.set(arg, true);
    else if (arg === "--headful") args.set("--headless", false);
    else if (arg.startsWith("--") && argv[index + 1] && !argv[index + 1].startsWith("--")) args.set(arg, argv[++index]);
  }
  return {
    payloadPath: typeof args.get("--payload") === "string" ? args.get("--payload") as string : undefined,
    dryRun: args.get("--dry-run") === true || process.env.DRY_RUN?.toLowerCase() === "true" || args.get("--allow-submit") !== true,
    allowSubmit: args.get("--allow-submit") === true,
    allowExternalAutomation: args.get("--allow-external") === true,
    headless: args.get("--headless") !== false,
    profileDir: typeof args.get("--profile-dir") === "string" ? args.get("--profile-dir") as string : undefined,
    resumeCaptcha: args.get("--resume-captcha") === true,
    runId: typeof args.get("--run-id") === "string" ? args.get("--run-id") as string : undefined,
  };
}

const invokedModuleUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (import.meta.url === invokedModuleUrl) {
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
