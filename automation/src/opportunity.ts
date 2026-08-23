import crypto from "node:crypto";
import type {
  ApplicationChannel,
  ExternalAts,
  JobOpportunity,
  NativePlatform,
  OpportunityStatus,
} from "./types.js";
import type { JavaExperienceScope, JavaMatchClassification } from "./matching/java-backend.js";
import { resolveResumeSelection, type ResumeProfileId, type SearchProfileId } from "./search-profiles.js";

const TRACKING_PARAMS = /^(utm_[^=]+|fbclid|gclid|mc_cid|mc_eid|ref|referrer|source)$/i;

export interface OpportunityInput {
  source: string;
  company: string;
  role: string;
  jobUrl: string;
  applicationUrl?: string;
  jobId?: string;
  location?: string;
  workArrangement?: string;
  postingAge?: string | number;
  postingAgeConfidence?: string;
  description?: string;
  descriptionReadComplete?: boolean;
  matchScore?: number;
  matchClassification?: JavaMatchClassification;
  searchProfile?: SearchProfileId;
  resumeProfile?: ResumeProfileId;
  selectedResume?: string;
  requiredYoe?: string;
  javaSpringRequirement?: string;
  javaExperienceScope?: JavaExperienceScope;
  whyCandidateMatches?: string[];
  gaps?: string[];
  applicationRoute?: string;
  applicationChannel?: ApplicationChannel;
  nativePlatform?: NativePlatform;
  externalAts?: ExternalAts;
  status?: OpportunityStatus;
  reasonCodes?: string[];
  discoveredAt?: string;
}

export function normalizeIdentityText(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function canonicalizeUrl(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
    url.searchParams.sort();
    return url.toString();
  } catch {
    return value.trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/$/, "");
  }
}

export function hostOf(value?: string): string | undefined {
  try {
    return value ? new URL(value).hostname.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

export function detectExternalAts(applicationUrl?: string): ExternalAts | undefined {
  const host = hostOf(applicationUrl);
  if (!host) return undefined;
  if (host.includes("myworkdayjobs.com") || host.includes("workday.com")) return "workday";
  if (host.includes("greenhouse.io") || host.includes("greenhouse.com")) return "greenhouse";
  if (host === "lever.co" || host.endsWith(".lever.co")) return "lever";
  if (host.includes("ashbyhq.com")) return "ashby";
  if (host.includes("smartrecruiters.com")) return "smartrecruiters";
  return "company";
}

export function nativePlatformFor(source: string): NativePlatform | undefined {
  const normalized = normalizeIdentityText(source).replace(/ /g, "");
  if (["linkedin", "naukri", "indeed", "wellfound"].includes(normalized)) return normalized as NativePlatform;
  return undefined;
}

function routeText(input: OpportunityInput): string {
  return [input.applicationRoute, input.applicationChannel].filter(Boolean).join(" ").toLowerCase();
}

export function classifyApplicationChannel(input: OpportunityInput): ApplicationChannel {
  if (input.applicationChannel) return input.applicationChannel;
  const route = routeText(input);
  if (/(easy[ _-]?apply|native|quick[ _-]?apply|apply[ _-]?on[ _-]?(linkedin|naukri|indeed|wellfound))/.test(route)) {
    return "native_easy_apply";
  }
  const jobHost = hostOf(input.jobUrl);
  const applicationHost = hostOf(input.applicationUrl);
  if (input.applicationUrl && applicationHost && jobHost && applicationHost !== jobHost) return "external_application";
  if (/(external|redirect|company|ats|employer)/.test(route)) return "external_application";
  return "unknown";
}

function identityMaterial(input: OpportunityInput): string {
  const company = normalizeIdentityText(input.company);
  const role = normalizeIdentityText(input.role);
  const location = normalizeIdentityText(input.location);
  const app = canonicalizeUrl(input.applicationUrl);
  const job = canonicalizeUrl(input.jobUrl);
  // A shared official application URL identifies the same opening across
  // sources. Otherwise job ID and canonical host disambiguate listings, with
  // normalized location preventing same-titled openings in different places
  // from collapsing when no stronger identifier is present.
  const sourceJobKey = app ? "" : `${hostOf(job) ?? ""}|${normalizeIdentityText(input.jobId)}|${location}`;
  return [company, role, app ?? "", sourceJobKey].join("|");
}

export function canonicalOpportunityId(input: OpportunityInput): string {
  const digest = crypto.createHash("sha256").update(identityMaterial(input)).digest("hex").slice(0, 20);
  return `opp-${digest}`;
}

export function opportunityAliases(input: OpportunityInput): string[] {
  const aliases = new Set<string>();
  const company = normalizeIdentityText(input.company);
  const role = normalizeIdentityText(input.role);
  aliases.add(`company-role:${company}|${role}`);
  if (input.location?.trim()) aliases.add(`company-role-location:${company}|${role}|${normalizeIdentityText(input.location)}`);
  if (input.jobId?.trim()) aliases.add(`job-id:${normalizeIdentityText(input.jobId)}`);
  for (const value of [input.jobUrl, input.applicationUrl]) {
    const canonical = canonicalizeUrl(value);
    if (canonical) aliases.add(`url:${canonical}`);
  }
  return [...aliases];
}

export function makeJobOpportunity(input: OpportunityInput): JobOpportunity {
  const applicationChannel = classifyApplicationChannel(input);
  const nativePlatform = input.nativePlatform ?? nativePlatformFor(input.source);
  const externalAts = input.externalAts ?? detectExternalAts(input.applicationUrl);
  const resumeSelection = resolveResumeSelection(input);
  return {
    id: canonicalOpportunityId(input),
    source: input.source,
    company: input.company,
    role: input.role,
    jobUrl: input.jobUrl,
    applicationUrl: input.applicationUrl,
    jobId: input.jobId,
    location: input.location,
    workArrangement: input.workArrangement,
    postingAge: input.postingAge,
    postingAgeConfidence: input.postingAgeConfidence,
    description: input.description,
    descriptionReadComplete: input.descriptionReadComplete ?? false,
    matchScore: input.matchScore,
    matchClassification: input.matchClassification,
    searchProfile: input.searchProfile,
    resumeProfile: resumeSelection?.resumeProfile,
    selectedResume: resumeSelection?.selectedResume,
    requiredYoe: input.requiredYoe,
    javaSpringRequirement: input.javaSpringRequirement,
    javaExperienceScope: input.javaExperienceScope,
    whyCandidateMatches: input.whyCandidateMatches,
    gaps: input.gaps,
    applicationChannel,
    nativePlatform,
    externalAts,
    status: input.status ?? "discovered",
    reasonCodes: input.reasonCodes ?? [],
    discoveredAt: input.discoveredAt ?? new Date().toISOString(),
  };
}

export function sameOpportunity(left: OpportunityInput, right: OpportunityInput): boolean {
  if (canonicalOpportunityId(left) === canonicalOpportunityId(right)) return true;
  const companyRole = opportunityAliases(left)[0] === opportunityAliases(right)[0];
  if (!companyRole) return false;
  const leftApp = canonicalizeUrl(left.applicationUrl);
  const rightApp = canonicalizeUrl(right.applicationUrl);
  if (leftApp && rightApp) return leftApp === rightApp;
  const leftLocation = normalizeIdentityText(left.location);
  const rightLocation = normalizeIdentityText(right.location);
  if (leftLocation && rightLocation && leftLocation !== rightLocation) return false;
  // When no shared official URL exists, a cross-platform listing with the
  // same company/role is the same opening for discovery purposes. The ledger
  // preserves every source URL and job ID as aliases for auditability.
  return true;
}
