import fs from "node:fs";
import path from "node:path";

export const DISCOVERY_LEDGER_SCHEMA_VERSION = 1;

export type PostingAgeConfidence = "exact" | "high" | "medium" | "low" | "unknown";

export type DiscoveryState =
  | "SEARCH_SAMPLE_EXHAUSTED"
  | "QUERY_EXHAUSTED"
  | "SOURCE_EXHAUSTED"
  | "SEARCH_SPACE_REASONABLY_EXHAUSTED";

export type DiscoveryReasonCode =
  | "RECENCY_TOO_OLD"
  | "RECENCY_UNKNOWN"
  | "EXPERIENCE_HARD_BLOCKER"
  | "PROFESSIONAL_JAVA_REQUIRED"
  | "WORK_AUTHORIZATION_MISMATCH"
  | "ROLE_MISMATCH"
  | "DUPLICATE"
  | "ALREADY_APPLIED"
  | "INSUFFICIENT_MATCH_SCORE"
  | "JOB_CLOSED"
  | "EXECUTOR_BLOCKED"
  | "ASSESSMENT"
  | "OTHER";

export interface DiscoveryJobRecord {
  record_type: "job";
  schema_version: number;
  run_id: string;
  timestamp: string;
  source: string;
  company: string;
  role: string;
  job_url: string;
  normalized_job_id: string;
  query: string;
  query_variant: string;
  location_filter?: string;
  page_number?: number;
  cursor?: string;
  result_position?: number;
  posting_age?: string | number;
  posting_age_confidence: PostingAgeConfidence;
  recency_class?: "within_window" | "too_old" | "unknown";
  match_score?: number;
  selected_resume?: string;
  decision: string;
  reason_codes: DiscoveryReasonCode[];
  executor_status?: string;
  blocker_type?: string;
}

export interface SearchTelemetryRecord {
  record_type: "search";
  schema_version: number;
  run_id: string;
  timestamp: string;
  source: string;
  query: string;
  query_variant: string;
  filters?: Record<string, string | number | boolean | null>;
  location?: string;
  page_number?: number;
  cursor?: string;
  results_visible: number;
  newly_discovered: number;
  duplicates: number;
  evaluated: number;
  has_next_page: boolean;
  pagination_completed: boolean;
  stop_reason?: DiscoveryState | "SEARCH_SAMPLE_EXHAUSTED" | "QUERY_EXHAUSTED" | "SOURCE_EXHAUSTED" | "RUN_SEARCH_SPACE_EXHAUSTED";
}

export interface ExecutorTelemetryRecord {
  record_type: "executor";
  schema_version: number;
  run_id: string;
  timestamp: string;
  company: string;
  role: string;
  job_url: string;
  normalized_job_id: string;
  executor: "local-playwright";
  ats_adapter?: string;
  starting_url?: string;
  final_url?: string;
  page_title?: string;
  current_phase: string;
  result_status: string;
  lifecycle?: string;
  blocker_type?: string;
  visible_evidence?: string;
  expected_company?: string;
  expected_role?: string;
  expected_job_id?: string;
  observed_company?: string;
  observed_role?: string;
  observed_job_id?: string;
  raw_result: unknown;
}

export interface DiscoveryLedgerPaths {
  directory: string;
  discoveryLedger: string;
  searchTelemetry: string;
  executorTelemetry: string;
}

export interface RecencyImpactSummary {
  withinWindow: number;
  tooOld: number;
  unknown: number;
}

export function summarizeRecency(records: Iterable<Pick<DiscoveryJobRecord, "recency_class" | "reason_codes">>): RecencyImpactSummary {
  const summary: RecencyImpactSummary = { withinWindow: 0, tooOld: 0, unknown: 0 };
  for (const record of records) {
    if (record.recency_class === "within_window") summary.withinWindow += 1;
    else if (record.recency_class === "too_old" || record.reason_codes.includes("RECENCY_TOO_OLD")) summary.tooOld += 1;
    else summary.unknown += 1;
  }
  return summary;
}

function appendJsonLine(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

export function runLedgerPaths(workspaceRoot: string, runId: string): DiscoveryLedgerPaths {
  const directory = path.join(workspaceRoot, "state", "runs", runId);
  return {
    directory,
    discoveryLedger: path.join(directory, "discovery-ledger.jsonl"),
    searchTelemetry: path.join(directory, "search-telemetry.jsonl"),
    executorTelemetry: path.join(directory, "executor-telemetry.jsonl"),
  };
}

export function normalizedJobId(jobId?: string, jobUrl?: string, applicationUrl?: string): string {
  if (jobId?.trim()) return jobId.trim().toLowerCase();
  const source = applicationUrl || jobUrl || "";
  try {
    const parsed = new URL(source);
    const withoutTracking = parsed.pathname.replace(/\/$/, "");
    return `${parsed.hostname.toLowerCase()}${withoutTracking}`.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  } catch {
    return source.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
  }
}

export class DiscoveryLedger {
  readonly paths: DiscoveryLedgerPaths;

  constructor(workspaceRoot: string, runId: string) {
    this.paths = runLedgerPaths(workspaceRoot, runId);
  }

  appendJob(record: Omit<DiscoveryJobRecord, "record_type" | "schema_version">): void {
    appendJsonLine(this.paths.discoveryLedger, {
      record_type: "job",
      schema_version: DISCOVERY_LEDGER_SCHEMA_VERSION,
      ...record,
    });
  }

  appendSearch(record: Omit<SearchTelemetryRecord, "record_type" | "schema_version">): void {
    appendJsonLine(this.paths.searchTelemetry, {
      record_type: "search",
      schema_version: DISCOVERY_LEDGER_SCHEMA_VERSION,
      ...record,
    });
  }

  appendExecutor(record: Omit<ExecutorTelemetryRecord, "record_type" | "schema_version">): void {
    appendJsonLine(this.paths.executorTelemetry, {
      record_type: "executor",
      schema_version: DISCOVERY_LEDGER_SCHEMA_VERSION,
      ...record,
    });
  }
}
