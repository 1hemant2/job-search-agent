import fs from "node:fs";
import path from "node:path";
import { canonicalOpportunityId, canonicalizeUrl } from "./opportunity.js";

export const DISCOVERY_LEDGER_SCHEMA_VERSION = 3;

export type PostingAgeConfidence = "exact" | "high" | "medium" | "low" | "unknown";

export type PageTransitionStatus = "not_attempted" | "changed" | "unchanged_retry" | "stalled";

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
  | "UNKNOWN_APPLICATION_ROUTE"
  | "NATIVE_UNSUPPORTED"
  | "EXTERNAL_MANUAL_QUEUE"
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
  application_url?: string;
  application_route?: string;
  normalized_job_id: string;
  opportunity_id: string;
  identity_aliases: string[];
  application_channel?: "native_easy_apply" | "external_application" | "unknown";
  native_platform?: string;
  external_ats?: string;
  opportunity_status?: string;
  work_arrangement?: string;
  description?: string;
  query: string;
  query_variant: string;
  location_filter?: string;
  job_location?: string;
  page_number?: number;
  cursor?: string;
  result_position?: number;
  posting_age?: string | number;
  posting_age_confidence: PostingAgeConfidence;
  description_read_complete?: boolean;
  recency_class?: "within_window" | "too_old" | "unknown";
  match_score?: number;
  match_classification?: string;
  search_profile?: string;
  selected_resume?: string;
  required_yoe?: string;
  java_spring_requirement?: string;
  java_experience_scope?: string;
  why_candidate_matches?: string[];
  gaps?: string[];
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
  visible_job_ids: string[];
  scroll_completed: boolean;
  newly_discovered: number;
  new_job_ids: string[];
  duplicates: number;
  duplicate_job_ids: string[];
  evaluated: number;
  evaluated_job_ids: string[];
  has_next_page: boolean;
  pagination_completed: boolean;
  next_page_status: PageTransitionStatus;
  page_transition_verified: boolean;
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
  opportunity_id?: string;
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
  runSummary: string;
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
    runSummary: path.join(directory, "run-summary.json"),
  };
}

export function normalizedJobId(jobId?: string, jobUrl?: string, applicationUrl?: string): string {
  if (jobId?.trim()) return jobId.trim().toLowerCase();
  const source = canonicalizeUrl(applicationUrl || jobUrl) || "";
  try {
    const parsed = new URL(source);
    const withoutTracking = parsed.pathname.replace(/\/$/, "");
    return `${parsed.hostname.toLowerCase()}${withoutTracking}`.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  } catch {
    return source.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
  }
}

export function canonicalDiscoveryId(input: { source: string; company: string; role: string; jobUrl: string; jobId?: string; applicationUrl?: string }): string {
  return canonicalOpportunityId(input);
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

  writeRunSummary(summary: unknown): void {
    fs.mkdirSync(path.dirname(this.paths.runSummary), { recursive: true });
    fs.writeFileSync(this.paths.runSummary, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }
}
