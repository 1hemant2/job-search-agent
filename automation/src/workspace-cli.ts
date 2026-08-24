import fs from "node:fs";
import path from "node:path";
import { freezeApplicationBatch } from "./application-batch.js";
import { buildDefaultDiscoveryPlan, DiscoveryCoordinator, type DiscoveryPlan } from "./discovery.js";
import { makeJobOpportunity } from "./opportunity.js";
import { OpportunityQueues, sortExternalForReview } from "./queues.js";
import { SOURCE_CAPABILITIES } from "./sources/index.js";
import { evaluateJavaBackendJob, type ExperienceRequirement, type JavaRequirement } from "./matching/java-backend.js";
import {
  RESUME_PATH_BY_PROFILE,
  resolveResumeSelection,
  searchProfileFromToken,
  selectResumeProfileForJob,
  type ResumeProfileId,
  type SearchProfileId,
} from "./search-profiles.js";

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
  profileScores?: Partial<Record<ResumeProfileId, number>>;
  resumeProfile?: ResumeProfileId;
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

function search(args: string[], freezeForStart = false): void {
  const explicitProfile = searchProfileFromToken(args[0]);
  const profile: SearchProfileId = explicitProfile ?? "node_backend";
  const target = Number(args.find((arg) => /^\d+$/.test(arg)) ?? "50");
  const id = argValue(args, "--run-id") ?? runId();
  const fixturePath = argValue(args, "--fixture");
  const useLiveQueues = args.includes("--live-queues");
  const fixture = fixturePath
    ? JSON.parse(fs.readFileSync(path.resolve(workspaceRoot, fixturePath), "utf8")) as FixtureRecord[]
    : [];
  const plan: DiscoveryPlan = fixture.length
    ? { runId: id, searchProfile: profile, sources: [{ source: "fixture", queries: [{ query: "fixture", queryVariant: "fixture", location: "India" }] }] }
    : buildDefaultDiscoveryPlan(id, { sources: SOURCE_CAPABILITIES.map((item) => item.source), searchProfile: profile });
  const coordinator = new DiscoveryCoordinator(workspaceRoot, plan, {
    persistRunState: !fixture.length || useLiveQueues,
    queueDirectory: fixture.length && !useLiveQueues ? path.join(workspaceRoot, "state", "runs", id, "queues") : undefined,
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
      mode: freezeForStart ? "two-stage-start" : "discovery-only",
      stage: "stage_1_blocked",
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
    const suppliedSelection = resolveResumeSelection(item);
    const resumeProfile = javaAssessment?.resumeProfile
      ?? suppliedSelection?.resumeProfile
      ?? selectResumeProfileForJob({ role: item.role, description: item.description, searchProfile: profile, profileScores: item.profileScores });
    const selectedResume = javaAssessment?.selectedResume
      ?? suppliedSelection?.selectedResume
      ?? RESUME_PATH_BY_PROFILE[resumeProfile];
    const chosenMatchScore = javaAssessment?.score ?? item.profileScores?.[resumeProfile] ?? matchScore;
    const decision = javaAssessment
      ? javaAssessment.classification === "APPLY" ? "apply"
        : javaAssessment.classification === "APPLY_STRETCH" ? "apply_stretch"
          : javaAssessment.classification.toLowerCase()
      : (chosenMatchScore ?? 0) >= 70 ? "qualifying" : "skipped";
    const opportunity = makeJobOpportunity({
      ...item,
      descriptionReadComplete: item.descriptionReadComplete ?? true,
      matchScore: chosenMatchScore,
      matchClassification: javaAssessment?.classification,
      searchProfile: profile,
      resumeProfile,
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
    console.log(JSON.stringify({ opportunityId: opportunity.id, route: result.route, company: opportunity.company, role: opportunity.role, searchProfile: profile, score: chosenMatchScore, classification: javaAssessment?.classification, resumeProfile, selectedResume }));
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
  const frozen = freezeForStart ? coordinator.freezeApplicationBatch() : undefined;
  console.log(JSON.stringify({
    mode: freezeForStart ? "two-stage-start" : "discovery-only",
    stage: freezeForStart ? "stage_2_ready" : "stage_1_complete",
    searchProfile: profile,
    runId: id,
    evaluated: capped.length,
    queuedForApplication: frozen?.manifest.items.length,
    applicationBatch: frozen ? `state/runs/${id}/application-batch.json` : undefined,
    runSummary: `state/runs/${id}/run-summary.json`,
  }, null, 2));
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

function freezeBatch(args: string[]): void {
  const id = args[0];
  if (!id) throw new Error("Usage: freeze <run-id>");
  const frozen = freezeApplicationBatch(workspaceRoot, id);
  console.log(JSON.stringify({
    mode: "freeze-application-batch",
    runId: id,
    queuedForApplication: frozen.manifest.items.length,
    applicationBatch: path.relative(workspaceRoot, frozen.path).replace(/\\/g, "/"),
  }, null, 2));
}

function help(): void {
  console.log("search [java|node] [count] [--fixture path] [--run-id id]");
  console.log("start [java|node] [count] [--fixture path] [--run-id id]");
  console.log("freeze <run-id>");
  console.log("apply native [java|node]");
  console.log("show external [java|node]");
  console.log("mark external <opportunity-id> applied|skipped");
  console.log("capabilities");
}

const args = process.argv.slice(2);
const command = args.shift();
try {
  if (command === "search") search(args);
  else if (command === "start") search(args, true);
  else if (command === "freeze") freezeBatch(args);
  else if (command === "apply" && args.shift() === "native") applyNative(args);
  else if (command === "show" && args.shift() === "external") showExternal(args);
  else if (command === "mark" && args.shift() === "external") markExternal(args);
  else if (command === "capabilities") printCapabilities();
  else help();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
