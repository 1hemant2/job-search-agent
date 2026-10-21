import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDefaultDiscoveryPlan, DiscoveryCoordinator, type DiscoveryPlan } from "../src/discovery.js";
import { summarizeRecency } from "../src/discovery-ledger.js";

function setup(plan: DiscoveryPlan): { root: string; coordinator: DiscoveryCoordinator } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "discovery-ledger-"));
  fs.mkdirSync(path.join(root, "state"), { recursive: true });
  fs.writeFileSync(path.join(root, "state", "run-state.md"), `# Run State\n\n## Active Run\n\n- Run ID: ${plan.runId}\n- Lifecycle state: running\n`, "utf8");
  return { root, coordinator: new DiscoveryCoordinator(root, plan) };
}

const oneQueryPlan = (runId: string): DiscoveryPlan => ({
  runId,
  sources: [{ source: "linkedin", queries: [{ query: "Backend Engineer", queryVariant: "backend-engineer", location: "Example Region" }] }],
});

function visibleIds(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
}

describe("discovery breadth and exhaustion state machine", () => {
  it("builds multiple compatible query variants for each planned source", () => {
    const plan = buildDefaultDiscoveryPlan("RUN-PLAN", { sources: ["linkedin"], location: "Example Region" });
    expect(plan.sources).toHaveLength(1);
    expect(plan.sources[0].queries.length).toBeGreaterThan(1);
    expect(plan.sources[0].queries.map((query) => query.query)).toContain("Software Engineer");
    expect(plan.sources[0].queries.map((query) => query.query)).toContain("API Engineer");
    expect(plan.sources[0].queries.every((query) => query.filters?.posted_within_days === 7)).toBe(true);
  });

  it("expands each role variant across the configured locations", () => {
    const plan = buildDefaultDiscoveryPlan("RUN-LOCATIONS", {
      sources: ["linkedin"],
      locations: ["Example Region", "Remote"],
    });
    expect(plan.sources[0].queries).toHaveLength(8);
    expect(plan.sources[0].queries.map((query) => query.location)).toContain("Example Region");
    expect(plan.sources[0].queries.map((query) => query.location)).toContain("Remote");
  });

  it("continues from page 1 with zero qualifying jobs to page 2", () => {
    const { coordinator } = setup(oneQueryPlan("RUN-PAGE-2"));
    expect(coordinator.recordSearchPage({
      source: "linkedin", query: "Backend Engineer", queryVariant: "backend-engineer", location: "Example Region",
      pageNumber: 1, resultsVisible: 20, newlyDiscovered: 20, duplicates: 0, evaluated: 20,
      hasNextPage: true, paginationCompleted: false, scrollCompleted: true, visibleJobIds: visibleIds("page-1", 20),
    })).toBe("SEARCH_SAMPLE_EXHAUSTED");
    expect(coordinator.canStopForSearchExhaustion()).toBe(false);

    coordinator.recordJob({
      source: "linkedin", company: "Example", role: "Backend Engineer", jobUrl: "https://www.linkedin.com/jobs/view/9999999999/",
      query: "Backend Engineer", queryVariant: "backend-engineer", pageNumber: 2, resultPosition: 1,
      postingAge: "1 day", postingAgeConfidence: "high", matchScore: 82, selectedResume: "resume.pdf",
      decision: "qualifying", reasonCodes: [],
    });
    expect(coordinator.recordSearchPage({
      source: "linkedin", query: "Backend Engineer", queryVariant: "backend-engineer", location: "Example Region",
      pageNumber: 2, resultsVisible: 20, newlyDiscovered: 20, duplicates: 0, evaluated: 1,
      hasNextPage: false, paginationCompleted: true, scrollCompleted: true, visibleJobIds: visibleIds("page-2", 20),
    })).toBe("SEARCH_SPACE_REASONABLY_EXHAUSTED");
  });

  it("requires a fully scrolled page and one job ID for every visible card", () => {
    const { coordinator } = setup(oneQueryPlan("RUN-PAGE-CAPTURE"));
    const base = {
      source: "linkedin", query: "Backend Engineer", queryVariant: "backend-engineer",
      pageNumber: 1, resultsVisible: 2, newlyDiscovered: 2, duplicates: 0, evaluated: 0,
      hasNextPage: false, paginationCompleted: true, visibleJobIds: visibleIds("capture", 2),
    };
    expect(() => coordinator.recordSearchPage({ ...base, scrollCompleted: false })).toThrow("fully scrolled");
    expect(() => coordinator.recordSearchPage({ ...base, scrollCompleted: true, visibleJobIds: ["capture-1"] })).toThrow("Every visible job card");
  });

  it("retries an unchanged page once, then records it as stalled", () => {
    const { coordinator } = setup(oneQueryPlan("RUN-PAGE-STALL"));
    const firstPage = {
      source: "linkedin", query: "Backend Engineer", queryVariant: "backend-engineer",
      pageNumber: 1, resultsVisible: 2, newlyDiscovered: 2, duplicates: 0, evaluated: 0,
      hasNextPage: true, paginationCompleted: false, scrollCompleted: true, visibleJobIds: visibleIds("same-page", 2),
    };
    expect(coordinator.recordSearchPage(firstPage)).toBe("SEARCH_SAMPLE_EXHAUSTED");
    expect(coordinator.recordSearchPage({ ...firstPage, nextPageStatus: "unchanged_retry" })).toBe("SEARCH_SAMPLE_EXHAUSTED");
    expect(coordinator.recordSearchPage({ ...firstPage, nextPageStatus: "stalled" })).toBe("SEARCH_SPACE_REASONABLY_EXHAUSTED");
  });

  it("continues from an exhausted query to the next planned query", () => {
    const { coordinator } = setup({
      runId: "RUN-QUERY-B",
      sources: [{ source: "linkedin", queries: [
        { query: "Backend Engineer", queryVariant: "backend-engineer" },
        { query: "Node.js Backend Engineer", queryVariant: "nodejs-backend-engineer" },
      ] }],
    });
    expect(coordinator.recordSearchPage({
      source: "linkedin", query: "Backend Engineer", queryVariant: "backend-engineer",
      pageNumber: 1, resultsVisible: 20, newlyDiscovered: 20, duplicates: 20, evaluated: 0,
      hasNextPage: false, paginationCompleted: true, scrollCompleted: true, visibleJobIds: visibleIds("query-a", 20),
    })).toBe("QUERY_EXHAUSTED");
    expect(coordinator.canStopForSearchExhaustion()).toBe(false);
    expect(coordinator.recordSearchPage({
      source: "linkedin", query: "Node.js Backend Engineer", queryVariant: "nodejs-backend-engineer",
      pageNumber: 1, resultsVisible: 20, newlyDiscovered: 5, duplicates: 15, evaluated: 5,
      hasNextPage: false, paginationCompleted: true, scrollCompleted: true, visibleJobIds: visibleIds("query-b", 20),
    })).toBe("SEARCH_SPACE_REASONABLY_EXHAUSTED");
  });

  it("does not stop after 20 evaluated jobs when planned queries remain", () => {
    const { coordinator } = setup({
      runId: "RUN-MORE-QUERIES",
      sources: [{ source: "linkedin", queries: [
        { query: "Backend Engineer", queryVariant: "backend-engineer" },
        { query: "Software Engineer Backend", queryVariant: "software-engineer-backend" },
      ] }],
    });
    for (let index = 0; index < 20; index += 1) {
      coordinator.recordJob({
        source: "linkedin", company: `Company ${index}`, role: "Backend Engineer", jobUrl: `https://example.test/jobs/${index}`,
        query: "Backend Engineer", queryVariant: "backend-engineer", pageNumber: 1,
        decision: "skipped", reasonCodes: ["INSUFFICIENT_MATCH_SCORE"],
      });
    }
    expect(coordinator.recordSearchPage({
      source: "linkedin", query: "Backend Engineer", queryVariant: "backend-engineer",
      pageNumber: 1, resultsVisible: 20, newlyDiscovered: 20, duplicates: 0, evaluated: 20,
      hasNextPage: false, paginationCompleted: true, scrollCompleted: true, visibleJobIds: visibleIds("remaining-a", 20),
    })).toBe("QUERY_EXHAUSTED");
    expect(coordinator.canStopForSearchExhaustion()).toBe(false);
  });

  it("requires all planned sources and queries to complete before final exhaustion", () => {
    const { coordinator } = setup({
      runId: "RUN-SOURCES",
      sources: [
        { source: "linkedin", queries: [{ query: "Backend Engineer", queryVariant: "backend-engineer" }] },
        { source: "greenhouse", queries: [{ query: "Backend Engineer", queryVariant: "backend-engineer" }] },
      ],
    });
    expect(coordinator.recordSearchPage({
      source: "linkedin", query: "Backend Engineer", queryVariant: "backend-engineer",
      pageNumber: 1, resultsVisible: 20, newlyDiscovered: 20, duplicates: 0, evaluated: 20,
      hasNextPage: false, paginationCompleted: true, scrollCompleted: true, visibleJobIds: visibleIds("source-a", 20),
    })).toBe("SOURCE_EXHAUSTED");
    expect(coordinator.canStopForSearchExhaustion()).toBe(false);
    expect(coordinator.recordSearchPage({
      source: "greenhouse", query: "Backend Engineer", queryVariant: "backend-engineer",
      pageNumber: 1, resultsVisible: 10, newlyDiscovered: 10, duplicates: 0, evaluated: 10,
      hasNextPage: false, paginationCompleted: true, scrollCompleted: true, visibleJobIds: visibleIds("source-b", 10),
    })).toBe("SEARCH_SPACE_REASONABLY_EXHAUSTED");
    expect(coordinator.canStopForSearchExhaustion()).toBe(true);
  });

  it("records a blocked qualifying job and still permits remaining discovery paths", () => {
    const { root, coordinator } = setup({
      runId: "RUN-BLOCKED-CONTINUE",
      sources: [{ source: "linkedin", queries: [
        { query: "Backend Engineer", queryVariant: "backend-engineer" },
        { query: "Node.js Developer", queryVariant: "nodejs-developer" },
      ] }],
    });
    coordinator.recordJob({
      source: "linkedin", company: "Blocked Co", role: "Backend Engineer", jobUrl: "https://example.test/jobs/blocked",
      query: "Backend Engineer", queryVariant: "backend-engineer", matchScore: 78,
      selectedResume: "resume.pdf", decision: "blocked", reasonCodes: ["EXECUTOR_BLOCKED"],
      executorStatus: "blocked", blockerType: "identity_mismatch",
    });
    expect(coordinator.recordSearchPage({
      source: "linkedin", query: "Backend Engineer", queryVariant: "backend-engineer",
      pageNumber: 1, resultsVisible: 1, newlyDiscovered: 1, duplicates: 0, evaluated: 1,
      hasNextPage: false, paginationCompleted: true, scrollCompleted: true, visibleJobIds: visibleIds("blocked", 1),
    })).toBe("QUERY_EXHAUSTED");
    expect(coordinator.canStopForSearchExhaustion()).toBe(false);
    const ledgerPath = path.join(root, "state", "runs", "RUN-BLOCKED-CONTINUE", "discovery-ledger.jsonl");
    const jobRecord = JSON.parse(fs.readFileSync(ledgerPath, "utf8").trim());
    expect(jobRecord.reason_codes).toEqual(["EXECUTOR_BLOCKED"]);
    expect(jobRecord.blocker_type).toBe("identity_mismatch");
  });
});

describe("discovery telemetry", () => {
  it("writes append-safe job and search records plus run-state pointers", () => {
    const { root, coordinator } = setup(oneQueryPlan("RUN-TELEMETRY"));
    coordinator.recordJob({
      source: "linkedin", company: "Example", role: "Backend Engineer", jobUrl: "https://example.test/jobs/123",
      query: "Backend Engineer", queryVariant: "backend-engineer", decision: "skipped",
      reasonCodes: ["RECENCY_TOO_OLD"], postingAge: "8 days", postingAgeConfidence: "exact",
      recencyClass: "too_old",
    });
    coordinator.recordSearchPage({
      source: "linkedin", query: "Backend Engineer", queryVariant: "backend-engineer",
      pageNumber: 1, resultsVisible: 1, newlyDiscovered: 1, duplicates: 0, evaluated: 1,
      hasNextPage: false, paginationCompleted: true, scrollCompleted: true, visibleJobIds: visibleIds("telemetry", 1),
    });
    const runDir = path.join(root, "state", "runs", "RUN-TELEMETRY");
    expect(fs.readFileSync(path.join(runDir, "discovery-ledger.jsonl"), "utf8")).toContain('"record_type":"job"');
    expect(fs.readFileSync(path.join(runDir, "search-telemetry.jsonl"), "utf8")).toContain('"record_type":"search"');
    const state = fs.readFileSync(path.join(root, "state", "run-state.md"), "utf8");
    expect(state).toContain("- Discovery state: SEARCH_SPACE_REASONABLY_EXHAUSTED");
    expect(state).toContain("- Discovery ledger: state/runs/RUN-TELEMETRY/discovery-ledger.jsonl");
    expect(state).toContain("- Status: terminal - search space reasonably exhausted");
  });

  it("measures recency filtering impact without changing the recency rule", () => {
    expect(summarizeRecency([
      { recency_class: "within_window", reason_codes: [] },
      { recency_class: "too_old", reason_codes: ["RECENCY_TOO_OLD"] },
      { recency_class: "unknown", reason_codes: ["RECENCY_UNKNOWN"] },
    ])).toEqual({ withinWindow: 1, tooOld: 1, unknown: 1 });
  });
});
