import fs from "node:fs";
import path from "node:path";
import type { ApplicationPayload, AtsName } from "./types.js";
import { resolveResumeSelection } from "./search-profiles.js";

const ATS_NAMES = new Set<AtsName>([
  "linkedin",
  "workday",
  "greenhouse",
  "lever",
  "ashby",
  "generic",
]);

const ATS_HOSTS: Record<AtsName, string[]> = {
  linkedin: ["linkedin.com", "www.linkedin.com"],
  workday: ["myworkdayjobs.com", "workday.com"],
  greenhouse: ["greenhouse.io", "greenhouse.com"],
  lever: ["lever.co", "jobs.lever.co"],
  ashby: ["ashbyhq.com", "jobs.ashbyhq.com"],
  generic: [],
};

export interface PayloadValidation {
  payload: ApplicationPayload;
  errors: string[];
}

export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hostFromUrl(value: string): string | undefined {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function isLocalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return false;
  }
}

function hostMatches(host: string, allowed: string): boolean {
  const normalized = allowed.toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  return host === normalized || host.endsWith(`.${normalized}`);
}

function isAllowedForAts(host: string, ats: AtsName): boolean {
  return ATS_HOSTS[ats].some((allowed) => hostMatches(host, allowed));
}

export function allowedHosts(payload: ApplicationPayload): string[] {
  const hosts = new Set<string>();
  for (const url of [payload.jobUrl, payload.applicationUrl]) {
    const host = url && hostFromUrl(url);
    if (host) hosts.add(host);
  }
  for (const domain of payload.allowedApplicationDomains ?? []) {
    const host = hostFromUrl(domain.includes("://") ? domain : `https://${domain}`);
    if (host) hosts.add(host);
  }
  return [...hosts];
}

export function isAllowedNavigation(payload: ApplicationPayload, url: string): boolean {
  const host = hostFromUrl(url);
  if (!host) return false;
  if (isLocalUrl(url)) return true;
  if (allowedHosts(payload).some((allowed) => hostMatches(host, allowed))) return true;
  return isAllowedForAts(host, payload.ats);
}

export function validateApplicationPayload(
  input: unknown,
  workspaceRoot = path.resolve(process.cwd(), ".."),
  allowLocalUrls = false,
): PayloadValidation {
  const value = (input ?? {}) as Partial<ApplicationPayload>;
  const errors: string[] = [];
  const ats = typeof value.ats === "string" ? value.ats.toLowerCase() as AtsName : undefined;

  if (!value.company?.trim()) errors.push("company is required");
  if (!value.role?.trim()) errors.push("role is required");
  if (!value.jobUrl?.trim()) errors.push("jobUrl is required");
  if (!ats || !ATS_NAMES.has(ats)) errors.push("ats must be linkedin, workday, greenhouse, lever, ashby, or generic");
  if (!value.resume?.trim()) errors.push("resume is required");
  if (!value.candidate || typeof value.candidate !== "object") errors.push("candidate is required");
  if (!value.answers || typeof value.answers !== "object" || Array.isArray(value.answers)) errors.push("answers must be an object");

  const urls = [value.jobUrl, value.applicationUrl].filter((item): item is string => Boolean(item));
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
      if (parsed.protocol !== "https:" && !(allowLocalUrls && local)) errors.push(`URL must use HTTPS: ${url}`);
    } catch {
      errors.push(`invalid URL: ${url}`);
    }
  }

  const targetUrl = value.applicationUrl ?? value.jobUrl;
  const targetHost = targetUrl ? hostFromUrl(targetUrl) : undefined;
  const explicitlyAllowed = targetHost && (value.allowedApplicationDomains ?? []).some((domain) => hostMatches(targetHost, domain));
  if (ats && targetHost && !isAllowedForAts(targetHost, ats) && !explicitlyAllowed && !allowLocalUrls && ats !== "generic") {
    errors.push(`application target host is not allowlisted for ATS ${ats}`);
  }
  if (ats === "linkedin" && value.applicationUrl && value.jobUrl) {
    const jobHost = hostFromUrl(value.jobUrl);
    const applicationHost = hostFromUrl(value.applicationUrl);
    if (jobHost && applicationHost && jobHost !== applicationHost && !(value.allowedApplicationDomains ?? []).length) {
      errors.push("allowedApplicationDomains is required for a LinkedIn redirect to another domain");
    }
  }

  if (value.candidate) {
    const candidate = value.candidate as Partial<ApplicationPayload["candidate"]>;
    for (const key of ["name", "email", "phone", "location"] as const) {
      if (!candidate[key]?.trim()) errors.push(`candidate.${key} is required`);
    }
  }

  if (value.resume) {
    const resumePath = path.resolve(workspaceRoot, value.resume);
    const resumesRoot = path.resolve(workspaceRoot, "candidate", "resumes");
    const relative = path.relative(resumesRoot, resumePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) errors.push("resume must be inside candidate/resumes");
    else if (!fs.existsSync(resumePath)) errors.push(`resume file does not exist: ${value.resume}`);
  }

  let resumeSelection: ReturnType<typeof resolveResumeSelection> = undefined;
  try {
    resumeSelection = resolveResumeSelection({
      resumeProfile: value.resumeProfile,
      selectedResume: value.resume,
    }, workspaceRoot);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const payload = {
    ...value,
    ats,
    resumeProfile: resumeSelection?.resumeProfile ?? value.resumeProfile,
    resume: resumeSelection?.selectedResume ?? value.resume,
  } as ApplicationPayload;
  return { payload, errors };
}

export function readPayloadFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function resumeAbsolutePath(payload: ApplicationPayload, workspaceRoot: string): string {
  const resolved = path.resolve(workspaceRoot, payload.resume);
  const resumesRoot = path.resolve(workspaceRoot, "candidate", "resumes");
  const relative = path.relative(resumesRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("resume is outside candidate/resumes");
  return resolved;
}

export function findDuplicate(payload: ApplicationPayload, historyText: string): string | undefined {
  const sections = historyText.split(/^##\s+/m).slice(1);
  // Blocked, failed, skipped, and assessment-only attempts remain retryable;
  // only completed applications participate in deduplication.
  const completedSections = sections.length
    ? sections.filter((section) => {
        const status = /Application status:\s*(.+)/i.exec(section)?.[1] ?? "";
        return !status || /^(?:Applied|Submitted|Successful)/i.test(status.trim());
      })
    : [historyText];
  const normalizedHistory = completedSections.join("\n").toLowerCase();
  if (payload.opportunityId && normalizedHistory.includes(payload.opportunityId.toLowerCase())) return "matching opportunityId found in application history";
  if (payload.jobUrl && normalizedHistory.includes(payload.jobUrl.toLowerCase())) return "matching jobUrl found in application history";
  if (payload.jobId && new RegExp(`\\b${escapeRegExp(payload.jobId)}\\b`, "i").test(completedSections.join("\n"))) return "matching jobId found in application history";

  const company = normalizeText(payload.company);
  const role = normalizeText(payload.role);
  for (const section of completedSections) {
    const sectionTitle = normalizeText(section.split(/\r?\n/, 1)[0] ?? "");
    if (sectionTitle.includes(company) && sectionTitle.includes(role)) return "matching company and role found in application history";
  }
  return undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
