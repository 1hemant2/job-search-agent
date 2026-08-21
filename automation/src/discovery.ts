import { DiscoveryLedger, normalizedJobId, type DiscoveryJobRecord, type DiscoveryReasonCode, type DiscoveryState, type PostingAgeConfidence, type SearchTelemetryRecord } from "./discovery-ledger.js";
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
  return {
    runId,
    sources: sources.map((source) => ({
      source,
      queries: DEFAULT_QUERY_VARIANTS.map(([query, queryVariant]) => ({
        query,
        queryVariant,
        location: options.location,
        filters: { posted_within_days: recencyDays },
      })),
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
  pageNumber?: number;
  cursor?: string;
  resultPosition?: number;
  postingAge?: string | number;
  postingAgeConfidence?: PostingAgeConfidence;
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
        });
      }
    }
  }

  recordSearchPage(input: SearchPageInput): DiscoveryState {
    const progress = this.requireQuery(input.source, input.queryVariant);
    progress.attempted = true;
    progress.pages += 1;
    progress.hasOpenCursor = input.hasNextPage;
    progress.paginationCompleted = Boolean(input.paginationCompleted) && !input.hasNextPage;
    this.activeQuery = `${input.source}:${input.queryVariant}`;
    this.nextCursorOrPage = input.hasNextPage ? (input.cursor ?? `page ${Number(input.pageNumber ?? progress.pages) + 1}`) : undefined;

    const stopReason = input.hasNextPage || !progress.paginationCompleted
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
      newly_discovered: input.newlyDiscovered,
      duplicates: input.duplicates,
      evaluated: input.evaluated,
      has_next_page: input.hasNextPage,
      pagination_completed: progress.paginationCompleted,
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
    const record: Omit<DiscoveryJobRecord, "record_type" | "schema_version"> = {
      run_id: this.plan.runId,
      timestamp: new Date().toISOString(),
      source: input.source,
      company: input.company,
      role: input.role,
      job_url: input.jobUrl,
      normalized_job_id: normalizedJobId(input.jobId, input.jobUrl),
      query: input.query,
      query_variant: input.queryVariant,
      location_filter: input.locationFilter,
      page_number: input.pageNumber,
      cursor: input.cursor,
      result_position: input.resultPosition,
      posting_age: input.postingAge,
      posting_age_confidence: input.postingAgeConfidence ?? "unknown",
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
