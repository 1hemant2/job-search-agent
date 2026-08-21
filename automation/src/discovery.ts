import { DiscoveryLedger, normalizedJobId, type DiscoveryJobRecord, type DiscoveryReasonCode, type DiscoveryState, type PageTransitionStatus, type PostingAgeConfidence, type SearchTelemetryRecord } from "./discovery-ledger.js";
import { updateDiscoveryRunState } from "./run-state.js";

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
  sources: DiscoverySourcePlan[];
}

export interface DefaultDiscoveryPlanOptions {
  sources?: string[];
  location?: string;
  locations?: string[];
  recencyDays?: number;
}

const DEFAULT_QUERY_VARIANTS: Array<[string, string]> = [
  ["Node.js Backend Engineer", "nodejs-backend-engineer"],
  ["Backend Engineer", "backend-engineer"],
  ["Software Engineer Backend", "software-engineer-backend"],
  ["Node.js Developer", "nodejs-developer"],
  ["TypeScript Backend Engineer", "typescript-backend-engineer"],
  ["API Engineer", "api-engineer"],
  ["Platform Engineer", "platform-engineer"],
  ["Distributed Systems Engineer", "distributed-systems-engineer"],
  ["Software Engineer I", "software-engineer-i"],
  ["SDE 1", "sde-1"],
  ["Software Engineer II", "software-engineer-ii"],
  ["SDE 2", "sde-2"],
  ["Java Backend Engineer", "java-backend-engineer"],
];

export function buildDefaultDiscoveryPlan(runId: string, options: DefaultDiscoveryPlanOptions = {}): DiscoveryPlan {
  const sources = options.sources?.length ? options.sources : ["linkedin", "company-careers", "greenhouse", "lever", "ashby", "workday", "wellfound", "yc-jobs"];
  const recencyDays = options.recencyDays ?? 7;
  const locations = options.locations?.length ? options.locations : [options.location];
  return {
    runId,
    sources: sources.map((source) => ({
      source,
      queries: DEFAULT_QUERY_VARIANTS.flatMap(([query, queryVariant]) => locations.map((location) => ({
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
  resultPosition?: number;
  postingAge?: string | number;
  postingAgeConfidence?: PostingAgeConfidence;
  descriptionReadComplete?: boolean;
  recencyClass?: "within_window" | "too_old" | "unknown";
  matchScore?: number;
  selectedResume?: string;
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
  private nextPageStatus: PageTransitionStatus = "not_attempted";
  private nextCursorOrPage?: string;

  constructor(private readonly workspaceRoot: string, plan: DiscoveryPlan) {
    this.plan = plan;
    this.ledger = new DiscoveryLedger(workspaceRoot, plan.runId);
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
    this.persistState();
    return stopReason;
  }

  recordJob(input: JobDiscoveryInput): void {
    this.jobsDiscovered += 1;
    if (input.decision) this.uniqueJobsEvaluated += 1;
    const normalizedId = normalizedJobId(input.jobId, input.jobUrl);
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
      selected_resume: input.selectedResume,
      decision: input.decision,
      reason_codes: input.reasonCodes ?? [],
      executor_status: input.executorStatus,
      blocker_type: input.blockerType,
    };
    this.ledger.appendJob(record);
    this.persistState();
  }

  currentState(): DiscoveryState {
    return this.lastState;
  }

  canStopForSearchExhaustion(): boolean {
    return this.lastState === "SEARCH_SPACE_REASONABLY_EXHAUSTED";
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
    const snapshot = this.snapshot();
    updateDiscoveryRunState(this.workspaceRoot, {
      ...snapshot,
      discoveryState: snapshot.state,
      discoveryLedger: this.ledger.paths.discoveryLedger.replace(`${this.workspaceRoot}\\`, "").replace(/\\/g, "/"),
      searchTelemetry: this.ledger.paths.searchTelemetry.replace(`${this.workspaceRoot}\\`, "").replace(/\\/g, "/"),
      executorTelemetry: this.ledger.paths.executorTelemetry.replace(`${this.workspaceRoot}\\`, "").replace(/\\/g, "/"),
    });
  }
}
