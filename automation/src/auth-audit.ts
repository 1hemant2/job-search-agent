import type { Page } from "playwright";

/**
 * The linked authbypass-authentication-flaws skill is a planning playbook, not
 * an executable dependency. This bridge deliberately exposes only passive
 * checks that are safe to run against an explicitly authorized target.
 */
export const AUTH_BYPASS_SKILL = "authbypass-authentication-flaws" as const;

export interface AuthAuditTarget {
  /** Explicit opt-in prevents accidentally scanning a copied URL. */
  authorized: true;
  baseUrl: string;
  loginUrl: string;
  resetUrl?: string;
  /** These routes are GET-only access-control observations. */
  protectedUrls?: string[];
  /** Additional exact hosts/subdomains intentionally in scope. */
  allowedHosts?: string[];
}

export type AuthFindingSeverity = "info" | "low" | "medium" | "high";

export interface AuthFinding {
  code: string;
  severity: AuthFindingSeverity;
  message: string;
  url: string;
  evidence?: string;
}

export interface AuthAuditReport {
  skill: typeof AUTH_BYPASS_SKILL;
  mode: "read-only";
  startedAt: string;
  completedAt: string;
  pagesChecked: string[];
  findings: AuthFinding[];
}

interface AuditOptions {
  timeoutMs?: number;
}

const SENSITIVE_COOKIE_RE = /(?:session|sess|auth|token|jwt|sid|remember|login)/i;
const TOKEN_PARAM_RE = /^(?:token|code|key|reset|nonce|ticket|state)$/i;
const AUTH_WALL_RE = /(?:sign\s*in|log\s*in|login|password|two[- ]factor|multi[- ]factor|mfa|verify your identity)/i;
const MFA_RE = /(?:two[- ]factor|multi[- ]factor|\bMFA\b|authenticator|verification code|one[- ]time password)/i;
const CSRF_RE = /(?:csrf|xsrf|authenticity|anti[- ]forgery)/i;

export async function runAuthenticationAudit(
  page: Page,
  target: AuthAuditTarget,
  options: AuditOptions = {},
): Promise<AuthAuditReport> {
  assertTarget(target);
  const startedAt = new Date().toISOString();
  const findings: AuthFinding[] = [];
  const pagesChecked: string[] = [];

  await auditPage(page, target, target.loginUrl, "login", findings, pagesChecked, options);
  if (target.resetUrl) await auditPage(page, target, target.resetUrl, "reset", findings, pagesChecked, options);
  for (const protectedUrl of target.protectedUrls ?? []) {
    await auditProtectedPage(page, target, protectedUrl, findings, pagesChecked, options);
  }

  return {
    skill: AUTH_BYPASS_SKILL,
    mode: "read-only",
    startedAt,
    completedAt: new Date().toISOString(),
    pagesChecked,
    findings,
  };
}

export function assertTarget(target: AuthAuditTarget): void {
  if (target.authorized !== true) throw new Error("auth audit requires authorized: true");
  for (const url of [target.baseUrl, target.loginUrl, target.resetUrl, ...(target.protectedUrls ?? [])]) {
    if (url) validateAuditUrl(url);
  }
}

function validateAuditUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`invalid auth audit URL: ${value}`);
  }
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    throw new Error(`auth audit URLs must use HTTPS (or local HTTP): ${value}`);
  }
  if (parsed.username || parsed.password) throw new Error("auth audit URLs must not contain credentials");
  return parsed;
}

function auditHosts(target: AuthAuditTarget): string[] {
  return [target.baseUrl, target.loginUrl, target.resetUrl, ...(target.protectedUrls ?? []), ...(target.allowedHosts ?? [])]
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      if (value.includes("://")) return new URL(value).hostname.toLowerCase();
      return value.toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
    });
}

function isAllowedAuditNavigation(target: AuthAuditTarget, value: string): boolean {
  const parsed = validateAuditUrl(value);
  const host = parsed.hostname.toLowerCase();
  return auditHosts(target).some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

async function auditPage(
  page: Page,
  target: AuthAuditTarget,
  url: string,
  kind: "login" | "reset",
  findings: AuthFinding[],
  pagesChecked: string[],
  options: AuditOptions,
): Promise<void> {
  await auditGoto(page, target, url, options.timeoutMs);
  const finalUrl = page.url();
  const safeUrl = redactUrl(finalUrl);
  pagesChecked.push(safeUrl);
  const body = await page.locator("body").innerText().catch(() => "");
  inspectUrl(finalUrl, kind, findings);
  await inspectForms(page, safeUrl, kind, findings);
  inspectMfa(body, safeUrl, findings);
  await inspectCookies(page, safeUrl, findings);
}

async function auditProtectedPage(
  page: Page,
  target: AuthAuditTarget,
  url: string,
  findings: AuthFinding[],
  pagesChecked: string[],
  options: AuditOptions,
): Promise<void> {
  const response = await auditGoto(page, target, url, options.timeoutMs);
  const finalUrl = page.url();
  const safeUrl = redactUrl(finalUrl);
  pagesChecked.push(safeUrl);
  const body = await page.locator("body").innerText().catch(() => "");
  const redirectedToAuth = finalUrl !== url && AUTH_WALL_RE.test(`${finalUrl} ${body}`);
  if ((response?.status() ?? 0) >= 200 && (response?.status() ?? 0) < 400 && !redirectedToAuth && !AUTH_WALL_RE.test(body)) {
    findings.push({
      code: "PROTECTED_ROUTE_NO_AUTH_WALL",
      severity: "high",
      message: "Protected URL returned content without an observable authentication wall.",
      url: safeUrl,
      evidence: `HTTP ${response?.status() ?? "unknown"}; no sign-in or verification marker detected`,
    });
  }
}

async function auditGoto(page: Page, target: AuthAuditTarget, url: string, timeoutMs = 15_000) {
  if (!isAllowedAuditNavigation(target, url)) throw new Error(`auth audit navigation is outside the explicit allowlist: ${url}`);
  return page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
}

function inspectUrl(url: string, kind: "login" | "reset", findings: AuthFinding[]): void {
  const parsed = new URL(url);
  const names = [...parsed.searchParams.keys()];
  const sensitive = names.filter((name) => TOKEN_PARAM_RE.test(name));
  if (sensitive.length) {
    findings.push({
      code: "SENSITIVE_AUTH_VALUE_IN_URL",
      severity: "medium",
      message: `${kind} page URL contains a token-like parameter; the value was intentionally not captured.`,
      url: redactUrl(url),
      evidence: `parameter names: ${sensitive.join(", ")}`,
    });
  }
}

function redactUrl(value: string): string {
  const parsed = new URL(value);
  for (const name of [...parsed.searchParams.keys()]) {
    if (TOKEN_PARAM_RE.test(name)) parsed.searchParams.set(name, "[REDACTED]");
  }
  return parsed.toString();
}

async function inspectForms(page: Page, url: string, kind: "login" | "reset", findings: AuthFinding[]): Promise<void> {
  const forms = page.locator("form");
  for (let index = 0; index < await forms.count(); index += 1) {
    const form = forms.nth(index);
    const passwordFields = form.locator("input[type='password']");
    const hasPassword = await passwordFields.count() > 0;
    const method = (await form.getAttribute("method"))?.toLowerCase() || "get";
    const action = await form.getAttribute("action");
    const resolvedAction = action ? new URL(action, url).toString() : url;
    if (hasPassword && method === "get") {
      findings.push({ code: "PASSWORD_FORM_USES_GET", severity: "medium", message: "A password-bearing form uses GET, which can expose credentials through URLs and history.", url, evidence: resolvedAction });
    }
    if (hasPassword) {
      const autocomplete = await passwordFields.first().getAttribute("autocomplete");
      if (!autocomplete || autocomplete.toLowerCase() === "off") {
        findings.push({ code: "PASSWORD_AUTOCOMPLETE_UNSPECIFIED", severity: "low", message: "Password autocomplete is missing or disabled; review the credential-manager behavior.", url });
      }
      if (method === "post") {
        const hiddenNames = await form.locator("input[type='hidden']").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("name") ?? ""));
        if (!hiddenNames.some((name) => CSRF_RE.test(name))) {
          findings.push({ code: "NO_VISIBLE_CSRF_MARKER", severity: "low", message: `${kind} POST form has no visible CSRF/anti-forgery field; verify server-side protection separately.`, url });
        }
      }
      if (!isSameSite(url, resolvedAction)) {
        findings.push({ code: "AUTH_FORM_EXTERNAL_ACTION", severity: "high", message: "Authentication form submits to a different site origin.", url, evidence: resolvedAction });
      }
    }
  }
}

function inspectMfa(body: string, url: string, findings: AuthFinding[]): void {
  if (MFA_RE.test(body)) findings.push({ code: "MFA_SURFACE_DETECTED", severity: "info", message: "MFA or verification language is present; review step-boundary enforcement manually.", url });
}

async function inspectCookies(page: Page, url: string, findings: AuthFinding[]): Promise<void> {
  const cookies = await page.context().cookies(url);
  for (const cookie of cookies.filter((item) => SENSITIVE_COOKIE_RE.test(item.name))) {
    if (new URL(url).protocol === "https:" && !cookie.secure) findings.push({ code: "AUTH_COOKIE_NOT_SECURE", severity: "medium", message: "A session-like cookie is not marked Secure on an HTTPS page.", url, evidence: cookie.name });
    if (!cookie.httpOnly) findings.push({ code: "AUTH_COOKIE_NOT_HTTP_ONLY", severity: "low", message: "A session-like cookie is readable by client-side JavaScript.", url, evidence: cookie.name });
    if (cookie.sameSite === "None") findings.push({ code: "AUTH_COOKIE_SAMESITE_NONE", severity: "medium", message: "A session-like cookie allows cross-site delivery; verify this is intentional.", url, evidence: cookie.name });
  }
}

function isSameSite(left: string, right: string): boolean {
  const a = new URL(left);
  const b = new URL(right);
  return a.protocol === b.protocol && a.hostname === b.hostname && a.port === b.port;
}
