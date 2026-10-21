import fs from "node:fs";
import path from "node:path";
import type { ExternalAts, JobOpportunity, NativePlatform } from "./types.js";
import type { JavaExperienceScope, JavaMatchClassification } from "./matching/java-backend.js";
import { resolveResumeSelection, type ResumeProfileId, type SearchProfileId } from "./search-profiles.js";

interface ProfileQueueFields {
  runId?: string;
  searchProfile?: SearchProfileId;
  resumeProfile?: ResumeProfileId;
  matchClassification?: JavaMatchClassification;
  requiredYoe?: string;
  javaSpringRequirement?: string;
  javaExperienceScope?: JavaExperienceScope;
  whyCandidateMatches?: string[];
  gaps?: string[];
}

export type NativeQueueStatus = "pending" | "in_progress" | "blocked" | "failed" | "submitted" | "native_unsupported" | "skipped";
export type ExternalQueueStatus = "pending" | "pending_manual" | "in_progress" | "blocked" | "failed" | "opened" | "submitted" | "applied" | "skipped" | "expired";

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

function readLatest<T extends QueueItem>(filePath: string, workspaceRoot?: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  const latest = new Map<string, T>();
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean)) {
    const parsed = JSON.parse(line) as T;
    const resumeSelection = resolveResumeSelection(parsed, workspaceRoot);
    const item = resumeSelection ? { ...parsed, ...resumeSelection } as T : parsed;
    latest.set(item.opportunityId, item);
  }
  return [...latest.values()];
}

export class OpportunityQueues {
  readonly paths: { native: string; external: string; unknown: string };
  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string, queueDirectory?: string) {
    this.workspaceRoot = workspaceRoot;
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

  nativeItems(): NativeQueueItem[] { return readLatest<NativeQueueItem>(this.paths.native, this.workspaceRoot); }
  externalItems(): ExternalQueueItem[] { return readLatest<ExternalQueueItem>(this.paths.external, this.workspaceRoot); }
  unknownItems(): UnknownRouteItem[] { return readLatest<UnknownRouteItem>(this.paths.unknown, this.workspaceRoot); }

  pendingNative(searchProfile?: SearchProfileId): NativeQueueItem[] {
    return this.nativeItems().filter((item) => ["pending", "failed", "native_unsupported"].includes(item.status)
      && (!searchProfile || item.searchProfile === searchProfile));
  }

  pendingExternal(searchProfile?: SearchProfileId): ExternalQueueItem[] {
    return this.externalItems().filter((item) => ["pending", "pending_manual", "failed"].includes(item.status)
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

export function routeOpportunity(
  workspaceRoot: string,
  opportunity: JobOpportunity,
  queues = new OpportunityQueues(workspaceRoot),
  context: { runId?: string } = {},
): RouteResult {
  const queuedAt = new Date().toISOString();
  const resumeSelection = resolveResumeSelection(opportunity, workspaceRoot);
  if (!resumeSelection) {
    throw new Error(`Qualifying opportunity ${opportunity.id} is missing canonical resume-selection metadata`);
  }
  if (opportunity.applicationChannel === "native_easy_apply") {
    const item: NativeQueueItem = {
      runId: context.runId,
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
      ...resumeSelection,
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
      runId: context.runId,
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
      ...resumeSelection,
      requiredYoe: opportunity.requiredYoe,
      javaSpringRequirement: opportunity.javaSpringRequirement,
      javaExperienceScope: opportunity.javaExperienceScope,
      whyCandidateMatches: opportunity.whyCandidateMatches,
      gaps: opportunity.gaps,
      postingAge: opportunity.postingAge,
      reasonMatched: opportunity.reasonCodes,
      discoveredAt: opportunity.discoveredAt,
      queuedAt,
      status: "pending",
    };
    queues.upsertExternal(item);
    return { route: "external", item };
  }
  const item: UnknownRouteItem = {
    runId: context.runId,
    opportunityId: opportunity.id,
    company: opportunity.company,
    role: opportunity.role,
    source: opportunity.source,
    jobUrl: opportunity.jobUrl,
    applicationUrl: opportunity.applicationUrl,
    matchScore: opportunity.matchScore,
    ...resumeSelection,
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
