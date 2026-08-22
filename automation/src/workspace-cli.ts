import fs from "node:fs";
import path from "node:path";
import { buildDefaultDiscoveryPlan, DiscoveryCoordinator, type DiscoveryPlan } from "./discovery.js";
import { makeJobOpportunity } from "./opportunity.js";
import { OpportunityQueues, sortExternalForReview } from "./queues.js";
import { SOURCE_CAPABILITIES } from "./sources/index.js";
import { evaluateJavaBackendJob, type ExperienceRequirement, type JavaRequirement } from "./matching/java-backend.js";
import { searchProfileFromToken, type SearchProfileId } from "./search-profiles.js";

interface FixtureRecord {
  source: string;
  company: string;
  role: string;
  jobUrl: string;
  applicationUrl?: string;
  jobId?: string;
  location?: string;
  postingAge?: string | number;
  description?: string;
  descriptionReadComplete?: boolean;
  matchScore?: number;
  selectedResume?: string;
  applicationRoute?: string;
  reasonCodes?: string[];
  query?: string;
  queryVariant?: string;
  requiredYoe?: ExperienceRequirement | string;
  javaRequirement?: JavaRequirement | string;
  indiaEligible?: boolean;
  recencyClass?: "within_window" | "too_old" | "unknown";
}

const workspaceRoot = path.resolve(process.cwd(), "..");

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function runId(): string {
  return `RUN-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-SEARCH`;
}

function printCapabilities(): void {
  for (const capability of SOURCE_CAPABILITIES) {
    console.log(JSON.stringify(capability));
  }
}

function search(args: string[]): void {
  const explicitProfile = searchProfileFromToken(args[0]);
  const profile: SearchProfileId = explicitProfile ?? "node_backend";
  const target = Number(args.find((arg) => /^\d+$/.test(arg)) ?? "50");
  const id = argValue(args, "--run-id") ?? runId();
  const fixturePath = argValue(args, "--fixture");
  const fixture = fixturePath
    ? JSON.parse(fs.readFileSync(path.resolve(workspaceRoot, fixturePath), "utf8")) as FixtureRecord[]
    : [];
  const plan: DiscoveryPlan = fixture.length
    ? { runId: id, searchProfile: explicitProfile, sources: [{ source: "fixture", queries: [{ query: "fixture", queryVariant: "fixture", location: "India" }] }] }
    : buildDefaultDiscoveryPlan(id, { sources: SOURCE_CAPABILITIES.map((item) => item.source), searchProfile: profile });
  const coordinator = new DiscoveryCoordinator(workspaceRoot, plan, {
    persistRunState: !fixture.length,
    queueDirectory: fixture.length ? path.join(workspaceRoot, "state", "runs", id, "queues") : undefined,
  });

  if (!fixture.length) {
    fs.mkdirSync(coordinator.ledger.paths.directory, { recursive: true });
    for (const telemetryPath of [coordinator.ledger.paths.discoveryLedger, coordinator.ledger.paths.searchTelemetry, coordinator.ledger.paths.executorTelemetry]) {
      if (!fs.existsSync(telemetryPath)) fs.writeFileSync(telemetryPath, "", "utf8");
    }
    coordinator.ledger.writeRunSummary({
      run_id: id,
      generated_at: new Date().toISOString(),
      status: "collectors_unavailable",
      evaluated: 0,
      qualifying: 0,
      recency_too_old: 0,
      recency_unknown: 0,
      score_too_low: 0,
      hard_blockers: 0,
      native_easy: 0,
      external: 0,
      unknown_route: 0,
      collectors: SOURCE_CAPABILITIES,
    });
    console.log(JSON.stringify({
      mode: "discovery-only",
      searchProfile: profile,
      requestedUniqueEvaluations: target,
      runId: id,
      collectors: SOURCE_CAPABILITIES,
      message: "No local source collector is implemented. Feed browser/session discovery records with --fixture or the coordinator API; no jobs were fabricated.",
      runSummary: `state/runs/${id}/run-summary.json`,
    }, null, 2));
    return;
  }

  const capped = fixture.slice(0, target);
  for (const [index, item] of capped.entries()) {
    const javaAssessment = profile === "java_backend" ? evaluateJavaBackendJob({
      company: item.company,
      role: item.role,
      description: item.description,
      location: item.location,
      requiredYoe: item.requiredYoe,
      javaRequirement: item.javaRequirement,
      indiaEligible: item.indiaEligible,
      searchProfile: profile,
    }) : undefined;
    const matchScore = javaAssessment?.score ?? item.matchScore;
    const selectedResume = javaAssessment?.selectedResume ?? item.selectedResume;
    const decision = javaAssessment
      ? javaAssessment.classification === "APPLY" ? "apply"
        : javaAssessment.classification === "APPLY_STRETCH" ? "apply_stretch"
          : javaAssessment.classification.toLowerCase()
      : (matchScore ?? 0) >= 70 ? "qualifying" : "skipped";
    const opportunity = makeJobOpportunity({
      ...item,
      descriptionReadComplete: item.descriptionReadComplete ?? true,
      matchScore,
      matchClassification: javaAssessment?.classification,
      searchProfile: explicitProfile,
      selectedResume,
      requiredYoe: javaAssessment?.requiredYoe,
      javaSpringRequirement: javaAssessment?.javaRequirement,
      javaExperienceScope: javaAssessment?.javaExperienceScope,
      whyCandidateMatches: javaAssessment?.whyCandidateMatches,
      gaps: javaAssessment?.gaps,
      status: "evaluated",
      reasonCodes: javaAssessment
        ? [...javaAssessment.reasonCodes, ...(javaAssessment.whyCandidateMatches.length ? ["MATCHED_CANDIDATE_PROFILE"] : [])]
        : item.reasonCodes ?? ["MATCHED_CANDIDATE_PROFILE"],
    });
    const result = coordinator.recordOpportunity(opportunity, {
      query: item.query ?? "fixture",
      queryVariant: item.queryVariant ?? "fixture",
      pageNumber: 1,
      resultPosition: index + 1,
      decision,
      recencyClass: item.recencyClass ?? "within_window",
    });
    console.log(JSON.stringify({ opportunityId: opportunity.id, route: result.route, company: opportunity.company, role: opportunity.role, searchProfile: profile, score: matchScore, classification: javaAssessment?.classification, selectedResume }));
  }
  const visible = capped.map((item) => makeJobOpportunity({
    source: item.source,
    company: item.company,
    role: item.role,
    jobUrl: item.jobUrl,
    applicationUrl: item.applicationUrl,
    jobId: item.jobId,
  }).id);
  coordinator.recordSearchPage({
    source: "fixture",
    query: "fixture",
    queryVariant: "fixture",
    pageNumber: 1,
    resultsVisible: visible.length,
    newlyDiscovered: visible.length,
    duplicates: 0,
    evaluated: visible.length,
    hasNextPage: false,
    paginationCompleted: true,
    scrollCompleted: true,
    visibleJobIds: visible,
  });
  console.log(JSON.stringify({ mode: "discovery-only", searchProfile: profile, runId: id, evaluated: capped.length, runSummary: `state/runs/${id}/run-summary.json` }, null, 2));
}

function profileArgument(args: string[]): SearchProfileId | undefined {
  return searchProfileFromToken(args[0]);
}

function showExternal(args: string[]): void {
  const items = sortExternalForReview(new OpportunityQueues(workspaceRoot).pendingExternal(profileArgument(args)));
  console.log(JSON.stringify(items, null, 2));
}

function markExternal(args: string[]): void {
  const id = args[0];
  const status = args[1] as "applied" | "skipped";
  if (!id || !["applied", "skipped"].includes(status)) throw new Error("Usage: mark external <opportunity-id> applied|skipped");
  const queues = new OpportunityQueues(workspaceRoot);
  const item = queues.externalItems().find((candidate) => candidate.opportunityId === id);
  if (!item) throw new Error(`External opportunity not found: ${id}`);
  queues.upsertExternal({ ...item, status });
  console.log(JSON.stringify({ opportunityId: id, status }));
}

function applyNative(args: string[]): void {
  const queues = new OpportunityQueues(workspaceRoot);
  const profile = profileArgument(args);
  const pending = queues.pendingNative(profile);
  console.log(JSON.stringify({
    mode: "native-apply",
    searchProfile: profile,
    queued: pending.length,
    ready: pending.filter((item) => item.status !== "native_unsupported").length,
    unsupported: pending.filter((item) => item.status === "native_unsupported").map((item) => ({ opportunityId: item.opportunityId, platform: item.platform })),
    message: "Queue loaded. The agent must resolve the stored payload and invoke the local Playwright runner for supported native flows; external jobs are never included.",
  }, null, 2));
}

function help(): void {
  console.log("search [java|node] [count] [--fixture path] [--run-id id]");
  console.log("apply native [java|node]");
  console.log("show external [java|node]");
  console.log("mark external <opportunity-id> applied|skipped");
  console.log("capabilities");
}

const args = process.argv.slice(2);
const command = args.shift();
try {
  if (command === "search") search(args);
  else if (command === "apply" && args.shift() === "native") applyNative(args);
  else if (command === "show" && args.shift() === "external") showExternal(args);
  else if (command === "mark" && args.shift() === "external") markExternal(args);
  else if (command === "capabilities") printCapabilities();
  else help();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
