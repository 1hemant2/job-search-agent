import fs from "node:fs";
import path from "node:path";
import type { ExternalAts, JobOpportunity, NativePlatform } from "./types.js";
import type { JavaExperienceScope, JavaMatchClassification } from "./matching/java-backend.js";
import type { SearchProfileId } from "./search-profiles.js";

interface ProfileQueueFields {
  searchProfile?: SearchProfileId;
  matchClassification?: JavaMatchClassification;
  requiredYoe?: string;
  javaSpringRequirement?: string;
  javaExperienceScope?: JavaExperienceScope;
  whyCandidateMatches?: string[];
  gaps?: string[];
}

export type NativeQueueStatus = "pending" | "in_progress" | "blocked" | "failed" | "submitted" | "native_unsupported" | "skipped";
export type ExternalQueueStatus = "pending_manual" | "opened" | "applied" | "skipped" | "expired";

export interface NativeQueueItem extends ProfileQueueFields {
  opportunityId: string;
  company: string;
  role: string;
  platform: NativePlatform | string;
  jobUrl: string;
  matchScore?: number;
  postingAge?: string | number;
  selectedResume?: string;
  queuedAt: string;
  status: NativeQueueStatus;
  retryCount: number;
  lastError?: string;
  applicationUrl?: string;
}

export interface ExternalQueueItem extends ProfileQueueFields {
  opportunityId: string;
  company: string;
  role: string;
  discoverySource: string;
  originalJobUrl: string;
  externalApplicationUrl?: string;
  detectedAts?: ExternalAts;
  matchScore?: number;
  selectedResume?: string;
  postingAge?: string | number;
  reasonMatched: string[];
  discoveredAt: string;
  queuedAt: string;
  status: ExternalQueueStatus;
}

export interface UnknownRouteItem extends ProfileQueueFields {
  opportunityId: string;
  company: string;
  role: string;
  source: string;
  jobUrl: string;
  applicationUrl?: string;
  matchScore?: number;
  selectedResume?: string;
  postingAge?: string | number;
  reasonCodes: string[];
  discoveredAt: string;
  queuedAt: string;
  status: "review" | "classified" | "skipped";
}

type QueueItem = NativeQueueItem | ExternalQueueItem | UnknownRouteItem;

function queuePath(queueDirectory: string, name: string): string {
  return path.join(queueDirectory, name);
}

function append<T extends QueueItem>(filePath: string, item: T): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(item)}\n`, "utf8");
}

function readLatest<T extends QueueItem>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  const latest = new Map<string, T>();
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean)) {
    const item = JSON.parse(line) as T;
    latest.set(item.opportunityId, item);
  }
  return [...latest.values()];
}

export class OpportunityQueues {
  readonly paths: { native: string; external: string; unknown: string };

  constructor(workspaceRoot: string, queueDirectory?: string) {
    const directory = queueDirectory ?? path.join(workspaceRoot, "state", "queues");
    this.paths = {
      native: queuePath(directory, "native-apply.jsonl"),
      external: queuePath(directory, "external-apply.jsonl"),
      unknown: queuePath(directory, "unknown-review.jsonl"),
    };
  }

  upsertNative(item: NativeQueueItem): void { append(this.paths.native, item); }
  upsertExternal(item: ExternalQueueItem): void { append(this.paths.external, item); }
  upsertUnknown(item: UnknownRouteItem): void { append(this.paths.unknown, item); }

  nativeItems(): NativeQueueItem[] { return readLatest<NativeQueueItem>(this.paths.native); }
  externalItems(): ExternalQueueItem[] { return readLatest<ExternalQueueItem>(this.paths.external); }
  unknownItems(): UnknownRouteItem[] { return readLatest<UnknownRouteItem>(this.paths.unknown); }

  pendingNative(searchProfile?: SearchProfileId): NativeQueueItem[] {
    return this.nativeItems().filter((item) => ["pending", "failed", "native_unsupported"].includes(item.status)
      && (!searchProfile || item.searchProfile === searchProfile));
  }

  pendingExternal(searchProfile?: SearchProfileId): ExternalQueueItem[] {
    return this.externalItems().filter((item) => item.status === "pending_manual"
      && (!searchProfile || item.searchProfile === searchProfile));
  }
}

export type RouteResult =
  | { route: "native"; item: NativeQueueItem }
  | { route: "external"; item: ExternalQueueItem }
  | { route: "unknown"; item: UnknownRouteItem }
  | { route: "duplicate"; opportunityId: string }
  | { route: "not_queued"; opportunityId: string };

const SUPPORTED_NATIVE_EXECUTION = new Set(["linkedin"]);

export function isNativeExecutionSupported(opportunity: JobOpportunity): boolean {
  return Boolean(opportunity.nativePlatform && SUPPORTED_NATIVE_EXECUTION.has(opportunity.nativePlatform));
}

export function routeOpportunity(workspaceRoot: string, opportunity: JobOpportunity, queues = new OpportunityQueues(workspaceRoot)): RouteResult {
  const queuedAt = new Date().toISOString();
  if (opportunity.applicationChannel === "native_easy_apply") {
    const item: NativeQueueItem = {
      opportunityId: opportunity.id,
      company: opportunity.company,
      role: opportunity.role,
      platform: opportunity.nativePlatform ?? opportunity.source,
      jobUrl: opportunity.jobUrl,
      applicationUrl: opportunity.applicationUrl,
      matchScore: opportunity.matchScore,
      matchClassification: opportunity.matchClassification,
      searchProfile: opportunity.searchProfile,
      postingAge: opportunity.postingAge,
      selectedResume: opportunity.selectedResume,
      requiredYoe: opportunity.requiredYoe,
      javaSpringRequirement: opportunity.javaSpringRequirement,
      javaExperienceScope: opportunity.javaExperienceScope,
      whyCandidateMatches: opportunity.whyCandidateMatches,
      gaps: opportunity.gaps,
      queuedAt,
      status: isNativeExecutionSupported(opportunity) ? "pending" : "native_unsupported",
      retryCount: 0,
    };
    queues.upsertNative(item);
    return { route: "native", item };
  }
  if (opportunity.applicationChannel === "external_application") {
    const item: ExternalQueueItem = {
      opportunityId: opportunity.id,
      company: opportunity.company,
      role: opportunity.role,
      discoverySource: opportunity.source,
      originalJobUrl: opportunity.jobUrl,
      externalApplicationUrl: opportunity.applicationUrl,
      detectedAts: opportunity.externalAts,
      matchScore: opportunity.matchScore,
      matchClassification: opportunity.matchClassification,
      searchProfile: opportunity.searchProfile,
      selectedResume: opportunity.selectedResume,
      requiredYoe: opportunity.requiredYoe,
      javaSpringRequirement: opportunity.javaSpringRequirement,
      javaExperienceScope: opportunity.javaExperienceScope,
      whyCandidateMatches: opportunity.whyCandidateMatches,
      gaps: opportunity.gaps,
      postingAge: opportunity.postingAge,
      reasonMatched: opportunity.reasonCodes,
      discoveredAt: opportunity.discoveredAt,
      queuedAt,
      status: "pending_manual",
    };
    queues.upsertExternal(item);
    return { route: "external", item };
  }
  const item: UnknownRouteItem = {
    opportunityId: opportunity.id,
    company: opportunity.company,
    role: opportunity.role,
    source: opportunity.source,
    jobUrl: opportunity.jobUrl,
    applicationUrl: opportunity.applicationUrl,
    matchScore: opportunity.matchScore,
    selectedResume: opportunity.selectedResume,
    postingAge: opportunity.postingAge,
    matchClassification: opportunity.matchClassification,
    searchProfile: opportunity.searchProfile,
    reasonCodes: opportunity.reasonCodes,
    requiredYoe: opportunity.requiredYoe,
    javaSpringRequirement: opportunity.javaSpringRequirement,
    javaExperienceScope: opportunity.javaExperienceScope,
    whyCandidateMatches: opportunity.whyCandidateMatches,
    gaps: opportunity.gaps,
    discoveredAt: opportunity.discoveredAt,
    queuedAt,
    status: "review",
  };
  queues.upsertUnknown(item);
  return { route: "unknown", item };
}

export function sortExternalForReview(items: ExternalQueueItem[]): ExternalQueueItem[] {
  return [...items].sort((left, right) => {
    const score = (right.matchScore ?? -1) - (left.matchScore ?? -1);
    if (score) return score;
    return String(left.postingAge ?? "").localeCompare(String(right.postingAge ?? ""));
  });
}
