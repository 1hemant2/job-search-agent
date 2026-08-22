import type { ApplicationPayload, Blocker, ExecutionResult, LifecycleState } from "./types.js";

export function resultFor(
  payload: ApplicationPayload,
  status: ExecutionResult["status"],
  lifecycle: LifecycleState,
  startedAt: number,
  extras: Partial<ExecutionResult> = {},
): ExecutionResult {
  return {
    status,
    lifecycle,
    opportunityId: payload.opportunityId,
    company: payload.company,
    role: payload.role,
    jobUrl: payload.jobUrl,
    ats: payload.ats,
    durationMs: Date.now() - startedAt,
    ...extras,
  };
}

export function blocker(type: Blocker["type"], message: string, extras: Omit<Blocker, "type" | "message"> = {}): Blocker {
  return { type, message, ...extras };
}

export function applicationBlocker(
  payload: ApplicationPayload,
  type: Blocker["type"],
  message: string,
  extras: Omit<Blocker, "type" | "message" | "company" | "role" | "ats"> = {},
): Blocker {
  return blocker(type, message, {
    company: payload.company,
    role: payload.role,
    ats: payload.ats,
    url: payload.applicationUrl ?? payload.jobUrl,
    ...extras,
  });
}

export function isApplicationLevelResult(result: ExecutionResult): boolean {
  return result.status === "blocked" || result.status === "failed" || result.status === "assessment" || result.status === "duplicate";
}

export function withoutSecrets(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(password|token|cookie|otp|mfa|secret|authorization)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]");
}
