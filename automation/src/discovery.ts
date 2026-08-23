import fs from "node:fs";
import { freezeApplicationBatch as freezeBatchManifest } from "./application-batch.js";
import { DiscoveryLedger, normalizedJobId, type DiscoveryJobRecord, type DiscoveryReasonCode, type DiscoveryState, type PageTransitionStatus, type PostingAgeConfidence, type SearchTelemetryRecord } from "./discovery-ledger.js";
import { makeJobOpportunity, opportunityAliases } from "./opportunity.js";
import { OpportunityQueues, routeOpportunity, type RouteResult } from "./queues.js";
import type { ApplicationChannel, ExternalAts, JobOpportunity, NativePlatform, OpportunityStatus } from "./types.js";
import { updateDiscoveryRunState } from "./run-state.js";
import { SEARCH_PROFILES, type ResumeProfileId, type SearchProfileId } from "./search-profiles.js";
import type { JavaExperienceScope, JavaMatchClassification } from "./matching/java-backend.js";

export interface DiscoveryQueryPlan {
  query: string;
  queryVariant: string;
  location?: string;
  filters?: Record<string, string | number | boolean | null>;
}

export interface DiscoverySourcePlan {
  source: string;
  queries: DiscoveryQueryPlan[];
}

export interface DiscoveryPlan {
  runId: string;
  searchProfile?: SearchProfileId;
  sources: DiscoverySourcePlan[];
}

export interface DiscoveryCoordinatorOptions {
  persistRunState?: boolean;
  queueDirectory?: string;
}

export interface DefaultDiscoveryPlanOptions {
  sources?: string[];
  location?: string;
  locations?: string[];
  recencyDays?: number;
  searchProfile?: SearchProfileId;
}

export function buildDefaultDiscoveryPlan(runId: string, options: DefaultDiscoveryPlanOptions = {}): DiscoveryPlan {
  const sources = options.sources?.length ? options.sources : ["linkedin", "company-careers", "greenhouse", "lever", "ashby", "workday", "wellfound", "yc-jobs"];
  const recencyDays = options.recencyDays ?? 7;
  const profile = SEARCH_PROFILES[options.searchProfile ?? "node_backend"];
  const locations = options.locations?.length ? options.locations : options.location ? [options.location] : profile.locations;
  return {
    runId,
    searchProfile: options.searchProfile,
    sources: sources.map((source) => ({
      source,
      queries: profile.queryVariants.flatMap(([query, queryVariant]) => locations.map((location) => ({
        query,
        queryVariant: location ? `${queryVariant}-${location.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : queryVariant,
        location,
        filters: { posted_within_days: recencyDays },
      }))),
    })),
  };
}

export interface SearchPageInput {
  source: string;
  query: string;
  queryVariant: string;
  filters?: Record<string, string | number | boolean | null>;
  location?: string;
  pageNumber?: number;
  cursor?: string;
  resultsVisible: number;
  newlyDiscovered: number;
  duplicates: number;
  evaluated: number;
  hasNextPage: boolean;
  paginationCompleted?: boolean;
  scrollCompleted: boolean;
  visibleJobIds: string[];
  newJobIds?: string[];
  duplicateJobIds?: string[];
  evaluatedJobIds?: string[];
  nextPageStatus?: PageTransitionStatus;
}

export interface JobDiscoveryInput {
  source: string;
  company: string;
  role: string;
  jobUrl: string;
  jobId?: string;
  query: string;
  queryVariant: string;
  locationFilter?: string;
  jobLocation?: string;
  pageNumber?: number;
  cursor?: string;
  applicationUrl?: string;
  applicationRoute?: string;
  applicationChannel?: ApplicationChannel;
  nativePlatform?: NativePlatform;
  externalAts?: ExternalAts;
  workArrangement?: string;
  description?: string;
  resultPosition?: number;
  postingAge?: string | number;
  postingAgeConfidence?: PostingAgeConfidence;
  descriptionReadComplete?: boolean;
  recencyClass?: "within_window" | "too_old" | "unknown";
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
  decision: string;
  reasonCodes?: DiscoveryReasonCode[];
  executorStatus?: string;
  blockerType?: string;
}

interface QueryProgress {
  source: string;
  queryVariant: string;
  attempted: boolean;
  paginationCompleted: boolean;
  hasOpenCursor: boolean;
  pages: number;
  lastPageNumber?: number;
  lastCursor?: string;
  lastFirstJobId?: string;
  lastLastJobId?: string;
  unchangedRetries: number;
  nextPageStatus: PageTransitionStatus;
  stalled: boolean;
}

export interface DiscoverySnapshot {
  runId: string;
  state: DiscoveryState;
  queriesCompleted: number;
  queriesPlanned: number;
  sourcesCompleted: number;
  sourcesPlanned: number;
  jobsDiscovered: number;
  uniqueJobsEvaluated: number;
  activeQuery?: string;
  activeSource?: string;
  activeLocation?: string;
  pageNumberOrCursor?: string;
  scrollCompleted: boolean;
  visibleJobIds: string[];
  evaluatedJobIds: string[];
  newJobIds: string[];
  duplicateJobIds: string[];
  nextPageStatus: PageTransitionStatus;
  nextCursorOrPage?: string;
}

function key(source: string, queryVariant: string): string {
  return `${source}::${queryVariant}`;
}

export class DiscoveryCoordinator {
  readonly ledger: DiscoveryLedger;
  readonly queues: OpportunityQueues;
  private readonly plan: DiscoveryPlan;
  private readonly queries = new Map<string, QueryProgress>();
  private lastState: DiscoveryState = "SEARCH_SAMPLE_EXHAUSTED";
  private jobsDiscovered = 0;
  private uniqueJobsEvaluated = 0;
  private activeQuery?: string;
  private activeSource?: string;
  private activeLocation?: string;
  private pageNumberOrCursor?: string;
  private scrollCompleted = false;
  private visibleJobIds: string[] = [];
  private readonly evaluatedJobIds = new Set<string>();
  private readonly newJobIds = new Set<string>();
  private readonly duplicateJobIds = new Set<string>();
  private readonly seenOpportunityIds = new Set<string>();
  private nextPageStatus: PageTransitionStatus = "not_attempted";
  private nextCursorOrPage?: string;

  private readonly persistRunStateEnabled: boolean;

  constructor(private readonly workspaceRoot: string, plan: DiscoveryPlan, options: DiscoveryCoordinatorOptions = {}) {
    this.plan = plan;
    this.persistRunStateEnabled = options.persistRunState ?? true;
    this.ledger = new DiscoveryLedger(workspaceRoot, plan.runId);
    this.queues = new OpportunityQueues(workspaceRoot, options.queueDirectory);
    for (const source of plan.sources) {
      for (const query of source.queries) {
        this.queries.set(key(source.source, query.queryVariant), {
          source: source.source,
          queryVariant: query.queryVariant,
          attempted: false,
          paginationCompleted: false,
          hasOpenCursor: false,
          pages: 0,
          unchangedRetries: 0,
          nextPageStatus: "not_attempted",
          stalled: false,
        });
      }
    }
  }

  recordSearchPage(input: SearchPageInput): DiscoveryState {
    const progress = this.requireQuery(input.source, input.queryVariant);
    if (!input.scrollCompleted) {
      throw new Error("Cannot advance discovery: the current results page was not fully scrolled");
    }

    const visibleJobIds = input.visibleJobIds.map((jobId) => jobId.trim()).filter(Boolean);
    if (visibleJobIds.length !== input.resultsVisible) {
      throw new Error("Every visible job card must have a recorded job ID before pagination continues");
    }
    const scrollCompleted = input.scrollCompleted;
    const firstJobId = visibleJobIds[0];
    const lastJobId = visibleJobIds[visibleJobIds.length - 1];
    const hasPreviousPage = progress.pages > 0;
    const pageIdentityChanged = !hasPreviousPage
      || progress.lastPageNumber !== input.pageNumber
      || progress.lastCursor !== input.cursor
      || progress.lastFirstJobId !== firstJobId
      || progress.lastLastJobId !== lastJobId;

    let nextPageStatus: PageTransitionStatus = input.nextPageStatus
      ?? (hasPreviousPage && !pageIdentityChanged ? "unchanged_retry" : hasPreviousPage ? "changed" : "not_attempted");
    if (hasPreviousPage && pageIdentityChanged && nextPageStatus === "stalled") {
      throw new Error("A page marked stalled must have the same page identity as the prior page");
    }
    if (hasPreviousPage && !pageIdentityChanged) {
      if (nextPageStatus !== "unchanged_retry" && nextPageStatus !== "stalled") {
        throw new Error("Page transition was not verified; retry the unchanged page once before marking it stalled");
      }
      if (nextPageStatus === "unchanged_retry") {
        if (progress.unchangedRetries >= 1) {
          throw new Error("The unchanged page has already been retried; mark it stalled and continue elsewhere");
        }
        progress.unchangedRetries += 1;
      }
    } else if (pageIdentityChanged) {
      progress.unchangedRetries = 0;
    }

    const stalled = nextPageStatus === "stalled";
    progress.attempted = true;
    progress.pages += 1;
    progress.hasOpenCursor = input.hasNextPage && !stalled;
    progress.paginationCompleted = stalled || (Boolean(input.paginationCompleted) && !input.hasNextPage);
    progress.lastPageNumber = input.pageNumber;
    progress.lastCursor = input.cursor;
    progress.lastFirstJobId = firstJobId;
    progress.lastLastJobId = lastJobId;
    progress.nextPageStatus = nextPageStatus;
    progress.stalled = stalled;
    this.activeQuery = `${input.source}:${input.queryVariant}`;
    this.activeSource = input.source;
    this.activeLocation = input.location;
    this.pageNumberOrCursor = input.cursor ?? (input.pageNumber === undefined ? undefined : String(input.pageNumber));
    this.scrollCompleted = scrollCompleted;
    this.visibleJobIds = visibleJobIds;
    this.nextPageStatus = nextPageStatus;
    this.nextCursorOrPage = input.hasNextPage && !stalled ? (input.cursor ?? `page ${Number(input.pageNumber ?? progress.pages) + 1}`) : undefined;

    const stopReason = input.hasNextPage && !stalled || !progress.paginationCompleted
      ? "SEARCH_SAMPLE_EXHAUSTED"
      : this.stateAfterCompletedQuery(progress);

    const record: Omit<SearchTelemetryRecord, "record_type" | "schema_version"> = {
      run_id: this.plan.runId,
      timestamp: new Date().toISOString(),
      source: input.source,
      query: input.query,
      query_variant: input.queryVariant,
      filters: input.filters,
      location: input.location,
      page_number: input.pageNumber,
      cursor: input.cursor,
      results_visible: input.resultsVisible,
      visible_job_ids: visibleJobIds,
      scroll_completed: scrollCompleted,
      newly_discovered: input.newlyDiscovered,
      new_job_ids: input.newJobIds ?? [...this.newJobIds],
      duplicates: input.duplicates,
      duplicate_job_ids: input.duplicateJobIds ?? [...this.duplicateJobIds],
      evaluated: input.evaluated,
      evaluated_job_ids: input.evaluatedJobIds ?? [...this.evaluatedJobIds],
      has_next_page: input.hasNextPage,
      pagination_completed: progress.paginationCompleted,
      next_page_status: nextPageStatus,
      page_transition_verified: !hasPreviousPage || pageIdentityChanged,
      stop_reason: stopReason,
    };
    this.ledger.appendSearch(record);
    this.lastState = stopReason;
    this.writeRunSummary();
    this.persistState();
    return stopReason;
  }

  recordJob(input: JobDiscoveryInput): void {
    this.jobsDiscovered += 1;
    if (input.decision) this.uniqueJobsEvaluated += 1;
    const opportunity = makeJobOpportunity({
      source: input.source,
      company: input.company,
      role: input.role,
      jobUrl: input.jobUrl,
      applicationUrl: input.applicationUrl,
      jobId: input.jobId,
      location: input.jobLocation,
      workArrangement: input.workArrangement,
      postingAge: input.postingAge,
      postingAgeConfidence: input.postingAgeConfidence,
      description: input.description,
      descriptionReadComplete: input.descriptionReadComplete,
      matchScore: input.matchScore,
      matchClassification: input.matchClassification,
      searchProfile: input.searchProfile,
      resumeProfile: input.resumeProfile,
      selectedResume: input.selectedResume,
      requiredYoe: input.requiredYoe,
      javaSpringRequirement: input.javaSpringRequirement,
      javaExperienceScope: input.javaExperienceScope,
      whyCandidateMatches: input.whyCandidateMatches,
      gaps: input.gaps,
      applicationRoute: input.applicationRoute,
      applicationChannel: input.applicationChannel,
      nativePlatform: input.nativePlatform,
      externalAts: input.externalAts,
      status: this.opportunityStatus(input),
      reasonCodes: input.reasonCodes ?? [],
    });
    const normalizedId = opportunity.id || normalizedJobId(input.jobId, input.jobUrl, input.applicationUrl);
    this.evaluatedJobIds.add(normalizedId);
    if (input.decision === "duplicate" || input.reasonCodes?.includes("DUPLICATE") || input.reasonCodes?.includes("ALREADY_APPLIED")) {
      this.duplicateJobIds.add(normalizedId);
    } else {
      this.newJobIds.add(normalizedId);
    }
    const record: Omit<DiscoveryJobRecord, "record_type" | "schema_version"> = {
      run_id: this.plan.runId,
      timestamp: new Date().toISOString(),
      source: input.source,
      company: input.company,
      role: input.role,
      job_url: input.jobUrl,
      application_url: input.applicationUrl,
      application_route: input.applicationRoute,
      normalized_job_id: normalizedId,
      opportunity_id: opportunity.id,
      identity_aliases: opportunityAliases({
        source: input.source,
        company: input.company,
        role: input.role,
        jobUrl: input.jobUrl,
        jobId: input.jobId,
        applicationUrl: input.applicationUrl,
      }),
      application_channel: opportunity.applicationChannel,
      native_platform: opportunity.nativePlatform,
      external_ats: opportunity.externalAts,
      opportunity_status: opportunity.status,
      work_arrangement: opportunity.workArrangement,
      description: opportunity.description,
      query: input.query,
      query_variant: input.queryVariant,
      location_filter: input.locationFilter,
      job_location: input.jobLocation,
      page_number: input.pageNumber,
      cursor: input.cursor,
      result_position: input.resultPosition,
      posting_age: input.postingAge,
      posting_age_confidence: input.postingAgeConfidence ?? "unknown",
      description_read_complete: input.descriptionReadComplete,
      recency_class: input.recencyClass,
      match_score: input.matchScore,
      match_classification: input.matchClassification,
      search_profile: input.searchProfile,
      resume_profile: opportunity.resumeProfile,
      selected_resume: input.selectedResume,
      required_yoe: input.requiredYoe,
      java_spring_requirement: input.javaSpringRequirement,
      java_experience_scope: input.javaExperienceScope,
      why_candidate_matches: input.whyCandidateMatches,
      gaps: input.gaps,
      decision: input.decision,
      reason_codes: input.reasonCodes ?? [],
      executor_status: input.executorStatus,
      blocker_type: input.blockerType,
    };
    this.ledger.appendJob(record);
    this.writeRunSummary();
    this.persistState();
  }

  /** Persist one fully normalized opportunity and route it to a durable queue. */
  recordOpportunity(opportunity: JobOpportunity, metadata: {
    query?: string;
    queryVariant?: string;
    pageNumber?: number;
    cursor?: string;
    resultPosition?: number;
    locationFilter?: string;
    decision?: string;
    recencyClass?: "within_window" | "too_old" | "unknown";
  } = {}): RouteResult {
    const duplicate = this.seenOpportunityIds.has(opportunity.id);
    this.seenOpportunityIds.add(opportunity.id);
    this.recordJob({
      source: opportunity.source,
      company: opportunity.company,
      role: opportunity.role,
      jobUrl: opportunity.jobUrl,
      applicationUrl: opportunity.applicationUrl,
      jobId: opportunity.jobId,
      jobLocation: opportunity.location,
      postingAge: opportunity.postingAge,
      postingAgeConfidence: opportunity.postingAgeConfidence as PostingAgeConfidence | undefined,
      descriptionReadComplete: opportunity.descriptionReadComplete,
      description: opportunity.description,
      matchScore: opportunity.matchScore,
      matchClassification: opportunity.matchClassification,
      searchProfile: opportunity.searchProfile,
      resumeProfile: opportunity.resumeProfile,
      selectedResume: opportunity.selectedResume,
      requiredYoe: opportunity.requiredYoe,
      javaSpringRequirement: opportunity.javaSpringRequirement,
      javaExperienceScope: opportunity.javaExperienceScope,
      whyCandidateMatches: opportunity.whyCandidateMatches,
      gaps: opportunity.gaps,
      applicationRoute: opportunity.applicationChannel,
      applicationChannel: opportunity.applicationChannel,
      nativePlatform: opportunity.nativePlatform,
      externalAts: opportunity.externalAts,
      workArrangement: opportunity.workArrangement,
      reasonCodes: duplicate ? [...opportunity.reasonCodes, "DUPLICATE"] as DiscoveryReasonCode[] : opportunity.reasonCodes as DiscoveryReasonCode[],
      decision: duplicate ? "duplicate" : metadata.decision ?? opportunity.status,
      query: metadata.query ?? opportunity.source,
      queryVariant: metadata.queryVariant ?? "manual-discovery",
      pageNumber: metadata.pageNumber,
      cursor: metadata.cursor,
      resultPosition: metadata.resultPosition,
      locationFilter: metadata.locationFilter,
      recencyClass: metadata.recencyClass,
    });
    if (duplicate) return { route: "duplicate", opportunityId: opportunity.id };
    if (!["qualifying", "apply", "apply_stretch"].includes(metadata.decision ?? "")) {
      return { route: "not_queued", opportunityId: opportunity.id };
    }
    return routeOpportunity(this.workspaceRoot, opportunity, this.queues, { runId: this.plan.runId });
  }

  private opportunityStatus(input: JobDiscoveryInput): OpportunityStatus {
    if (["qualifying", "apply", "apply_stretch"].includes(input.decision)) {
      if (input.applicationChannel === "native_easy_apply") return "queued_native";
      if (input.applicationChannel === "external_application") return "queued_external";
    }
    if (input.applicationChannel === "unknown") return "unknown_route";
    if (input.decision === "skipped") return "skipped";
    if (input.decision === "blocked") return "blocked";
    if (input.decision === "failed") return "failed";
    return "evaluated";
  }

  currentState(): DiscoveryState {
    return this.lastState;
  }

  canStopForSearchExhaustion(): boolean {
    return this.lastState === "SEARCH_SPACE_REASONABLY_EXHAUSTED";
  }

  freezeApplicationBatch(): ReturnType<typeof freezeBatchManifest> {
    return freezeBatchManifest(this.workspaceRoot, this.plan.runId, this.queues);
  }

  snapshot(): DiscoverySnapshot {
    const queriesCompleted = [...this.queries.values()].filter((item) => item.paginationCompleted && !item.hasOpenCursor).length;
    const sourcesCompleted = this.plan.sources.filter((source) => source.queries.length > 0 && source.queries.every((query) => this.queries.get(key(source.source, query.queryVariant))?.paginationCompleted)).length;
    return {
      runId: this.plan.runId,
      state: this.lastState,
      queriesCompleted,
      queriesPlanned: this.queries.size,
      sourcesCompleted,
      sourcesPlanned: this.plan.sources.length,
      jobsDiscovered: this.jobsDiscovered,
      uniqueJobsEvaluated: this.uniqueJobsEvaluated,
      activeQuery: this.activeQuery,
      activeSource: this.activeSource,
      activeLocation: this.activeLocation,
      pageNumberOrCursor: this.pageNumberOrCursor,
      scrollCompleted: this.scrollCompleted,
      visibleJobIds: this.visibleJobIds,
      evaluatedJobIds: [...this.evaluatedJobIds],
      newJobIds: [...this.newJobIds],
      duplicateJobIds: [...this.duplicateJobIds],
      nextPageStatus: this.nextPageStatus,
      nextCursorOrPage: this.nextCursorOrPage,
    };
  }

  private requireQuery(source: string, queryVariant: string): QueryProgress {
    const progress = this.queries.get(key(source, queryVariant));
    if (!progress) throw new Error(`Query ${source}/${queryVariant} is not in the discovery plan`);
    return progress;
  }

  private stateAfterCompletedQuery(progress: QueryProgress): DiscoveryState {
    const sourcePlan = this.plan.sources.find((source) => source.source === progress.source);
    if (!sourcePlan) throw new Error(`Source ${progress.source} is not in the discovery plan`);
    const sourceQueriesComplete = sourcePlan.queries.every((query) => this.queries.get(key(sourcePlan.source, query.queryVariant))?.paginationCompleted);
    const laterQueryExists = sourcePlan.queries.some((query) => {
      const candidate = this.queries.get(key(sourcePlan.source, query.queryVariant));
      return candidate && !candidate.paginationCompleted;
    });
    if (laterQueryExists) return "QUERY_EXHAUSTED";
    if (!sourceQueriesComplete) return "QUERY_EXHAUSTED";
    const laterSourceExists = this.plan.sources.some((source) => {
      if (source.source === progress.source) return false;
      return source.queries.some((query) => !this.queries.get(key(source.source, query.queryVariant))?.paginationCompleted);
    });
    if (laterSourceExists) return "SOURCE_EXHAUSTED";
    return this.allPlannedQueriesComplete() ? "SEARCH_SPACE_REASONABLY_EXHAUSTED" : "SOURCE_EXHAUSTED";
  }

  private allPlannedQueriesComplete(): boolean {
    return [...this.queries.values()].every((item) => item.paginationCompleted && !item.hasOpenCursor);
  }

  private persistState(): void {
    if (!this.persistRunStateEnabled) return;
    const snapshot = this.snapshot();
    updateDiscoveryRunState(this.workspaceRoot, {
      ...snapshot,
      discoveryState: snapshot.state,
      discoveryLedger: this.ledger.paths.discoveryLedger.replace(`${this.workspaceRoot}\\`, "").replace(/\\/g, "/"),
      searchTelemetry: this.ledger.paths.searchTelemetry.replace(`${this.workspaceRoot}\\`, "").replace(/\\/g, "/"),
      executorTelemetry: this.ledger.paths.executorTelemetry.replace(`${this.workspaceRoot}\\`, "").replace(/\\/g, "/"),
    });
  }

  private writeRunSummary(): void {
    const records = fs.existsSync(this.ledger.paths.discoveryLedger)
      ? fs.readFileSync(this.ledger.paths.discoveryLedger, "utf8").split(/\r?\n/).filter(Boolean).map((line: string) => JSON.parse(line) as DiscoveryJobRecord)
      : [];
    const count = (predicate: (record: DiscoveryJobRecord) => boolean) => records.filter(predicate).length;
    this.ledger.writeRunSummary({
      run_id: this.plan.runId,
      search_profile: this.plan.searchProfile,
      generated_at: new Date().toISOString(),
      evaluated: records.length,
      qualifying: count((record) => ["qualifying", "apply", "apply_stretch"].includes(record.decision)),
      recency_too_old: count((record) => record.recency_class === "too_old" || record.reason_codes.includes("RECENCY_TOO_OLD")),
      recency_unknown: count((record) => record.recency_class === "unknown" || record.reason_codes.includes("RECENCY_UNKNOWN")),
      score_too_low: count((record) => record.reason_codes.includes("INSUFFICIENT_MATCH_SCORE")),
      hard_blockers: count((record) => record.reason_codes.some((code) => ["EXPERIENCE_HARD_BLOCKER", "WORK_AUTHORIZATION_MISMATCH", "ROLE_MISMATCH"].includes(code))),
      native_easy: count((record) => record.application_channel === "native_easy_apply"),
      external: count((record) => record.application_channel === "external_application"),
      unknown_route: count((record) => record.application_channel === "unknown"),
      queue_paths: this.queues.paths,
      discovery_state: this.lastState,
    });
  }
}
