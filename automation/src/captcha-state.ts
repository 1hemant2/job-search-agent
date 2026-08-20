import fs from "node:fs";
import path from "node:path";
import { normalizeText } from "./application-payload.js";
import type { ApplicationPayload } from "./types.js";

export interface CaptchaCheckpoint {
  workflowStep: string;
  fieldsCompleted?: string[];
  unresolvedQuestions?: string[];
}

export function captchaQueueKey(payload: ApplicationPayload): string {
  return normalizeText([
    payload.company,
    payload.role,
    payload.ats,
    payload.applicationUrl ?? payload.jobUrl,
    payload.jobId ?? "",
  ].join("|"));
}

function markerFor(payload: ApplicationPayload): string {
  return `<!-- captcha-queue-key: ${captchaQueueKey(payload)} -->`;
}

function queuePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, "candidate", "human-input-queue.md");
}

function runStatePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, "state", "run-state.md");
}

function safeLine(value: string | undefined, fallback = "unknown"): string {
  return (value ?? fallback).replace(/[\r\n]+/g, " ").trim();
}

function resumeName(resume: string): string {
  return path.basename(resume.replace(/\\/g, "/"));
}

function sectionFor(text: string, marker: string): { start: number; end: number; text: string } | undefined {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return undefined;
  const start = text.lastIndexOf("\n## ", markerIndex) + 1;
  const next = text.indexOf("\n## ", markerIndex + marker.length);
  const end = next < 0 ? text.length : next;
  return { start, end, text: text.slice(start, end) };
}

export function hasActiveCaptchaBlocker(workspaceRoot: string, payload: ApplicationPayload): boolean {
  const file = queuePath(workspaceRoot);
  if (!fs.existsSync(file)) return false;
  const section = sectionFor(fs.readFileSync(file, "utf8"), markerFor(payload));
  if (!section) return false;
  return /- status:\s*blocked_captcha\b/i.test(section.text);
}

export function recordCaptchaBlocker(
  workspaceRoot: string,
  payload: ApplicationPayload,
  checkpoint: CaptchaCheckpoint,
  now = new Date(),
): { queueKey: string; duplicate: boolean } {
  const file = queuePath(workspaceRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "# Human Input Queue\n";
  const marker = markerFor(payload);
  const current = sectionFor(existing, marker);
  if (current && /- status:\s*blocked_captcha\b/i.test(current.text)) {
    updateRunState(workspaceRoot, payload, checkpoint);
    return { queueKey: captchaQueueKey(payload), duplicate: true };
  }

  const entry = formatCaptchaEntry(payload, checkpoint, now, marker);
  const next = current
    ? `${existing.slice(0, current.start)}${entry}${existing.slice(current.end)}`
    : `${existing.trimEnd()}\n\n${entry}`;
  fs.writeFileSync(file, `${next.trimEnd()}\n`, "utf8");
  updateRunState(workspaceRoot, payload, checkpoint);
  return { queueKey: captchaQueueKey(payload), duplicate: Boolean(current) };
}

export function resolveCaptchaBlocker(workspaceRoot: string, payload: ApplicationPayload, now = new Date()): boolean {
  const file = queuePath(workspaceRoot);
  if (!fs.existsSync(file)) return false;
  const existing = fs.readFileSync(file, "utf8");
  const marker = markerFor(payload);
  const current = sectionFor(existing, marker);
  if (!current || !/- status:\s*blocked_captcha\b/i.test(current.text)) return false;
  const resolved = current.text
    .replace(/- status:\s*blocked_captcha\s*/i, "- status: resolved_captcha\n")
    .replace(/- resolved_at:[^\n]*\n?/i, "")
    .replace(/\n?$/, `\n- resolved_at: ${now.toISOString()}\n- resolution: CAPTCHA verification cleared; application may continue\n`);
  fs.writeFileSync(file, `${existing.slice(0, current.start)}${resolved}${existing.slice(current.end)}`.trimEnd() + "\n", "utf8");
  return true;
}

function formatCaptchaEntry(
  payload: ApplicationPayload,
  checkpoint: CaptchaCheckpoint,
  now: Date,
  marker: string,
): string {
  const fields = checkpoint.fieldsCompleted?.length ? checkpoint.fieldsCompleted.join(", ") : "none recorded";
  const questions = checkpoint.unresolvedQuestions?.length ? checkpoint.unresolvedQuestions.join(" | ") : "none";
  return [
    `## CAPTCHA — ${safeLine(payload.company)} — ${safeLine(payload.role)}`,
    marker,
    "",
    "- status: blocked_captcha",
    `- company: ${safeLine(payload.company)}`,
    `- role: ${safeLine(payload.role)}`,
    `- ats: ${safeLine(payload.ats)}`,
    `- url: ${safeLine(payload.applicationUrl ?? payload.jobUrl)}`,
    `- job_id: ${safeLine(payload.jobId, "not provided")}`,
    `- reason: Human CAPTCHA verification required`,
    `- resume: ${resumeName(payload.resume)}`,
    `- resume_step: ${safeLine(checkpoint.workflowStep)}`,
    `- application_state: ${safeLine(checkpoint.workflowStep)}`,
    `- fields_completed: ${fields}`,
    `- unresolved_questions: ${questions}`,
    `- queued_at: ${now.toISOString()}`,
    "- resume_action: After manual CAPTCHA completion, rerun the same payload with --resume-captcha.",
    "",
  ].join("\n");
}

function updateRunState(workspaceRoot: string, payload: ApplicationPayload, checkpoint: CaptchaCheckpoint): void {
  const file = runStatePath(workspaceRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "# Run State\n\n## Active Run\n";
  const updates: Array<[RegExp, string]> = [
    [/^- Last checkpoint:.*$/m, `- Last checkpoint: ${safeLine(payload.company)} / ${safeLine(payload.role)}; CAPTCHA blocker queued`],
    [/^- Current job URL:.*$/m, `- Current job URL: ${safeLine(payload.jobUrl)}`],
    [/^- Current application URL:.*$/m, `- Current application URL: ${safeLine(payload.applicationUrl ?? payload.jobUrl)}`],
    [/^- Current job ID:.*$/m, `- Current job ID: ${safeLine(payload.jobId, "not provided")}`],
    [/^- Current ATS:.*$/m, `- Current ATS: ${safeLine(payload.ats)}`],
    [/^- Lifecycle state:.*$/m, "- Lifecycle state: blocked_captcha"],
    [/^- Selected resume:.*$/m, `- Selected resume: ${resumeName(payload.resume)}`],
    [/^- Pending blocker reference:.*$/m, "- Pending blocker reference: human CAPTCHA verification required"],
  ];
  for (const [pattern, replacement] of updates) {
    if (pattern.test(text)) text = text.replace(pattern, replacement);
  }
  if (!/^- Current application URL:/m.test(text)) {
    text = text.replace(/(^- Current job URL:.*$)/m, `$1\n- Current application URL: ${safeLine(payload.applicationUrl ?? payload.jobUrl)}`);
  }
  if (!text.includes("- Lifecycle state: blocked_captcha")) {
    text = `${text.trimEnd()}\n\n## CAPTCHA Checkpoint\n\n- status: blocked_captcha\n- company: ${safeLine(payload.company)}\n- role: ${safeLine(payload.role)}\n- ats: ${safeLine(payload.ats)}\n- application URL: ${safeLine(payload.applicationUrl ?? payload.jobUrl)}\n- workflow step: ${safeLine(checkpoint.workflowStep)}\n- selected resume: ${resumeName(payload.resume)}\n- pending blocker reference: human CAPTCHA verification required\n`;
  }
  fs.writeFileSync(file, `${text.trimEnd()}\n`, "utf8");
}
