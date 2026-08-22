import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDefaultDiscoveryPlan, DiscoveryCoordinator } from "../src/discovery.js";
import { canonicalOpportunityId, classifyApplicationChannel, makeJobOpportunity } from "../src/opportunity.js";
import { OpportunityQueues, sortExternalForReview } from "../src/queues.js";
import { executeApplication } from "../src/runner.js";

function workspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "discovery-first-"));
  fs.mkdirSync(path.join(root, "state"), { recursive: true });
  fs.writeFileSync(path.join(root, "state", "run-state.md"), "# Run State\n\n## Active Run\n\n- Run ID: RUN-DISCOVERY-FIRST\n", "utf8");
  fs.mkdirSync(path.join(root, "resumes"), { recursive: true });
  fs.writeFileSync(path.join(root, "resumes", "resume.pdf"), "fixture", "utf8");
  return root;
}

describe("discovery-first routing", () => {
  it("classifies LinkedIn Easy Apply as native and external Apply as external", () => {
    expect(classifyApplicationChannel({ source: "linkedin", company: "A", role: "B", jobUrl: "https://www.linkedin.com/jobs/view/1", applicationRoute: "easy_apply" })).toBe("native_easy_apply");
    expect(classifyApplicationChannel({ source: "linkedin", company: "A", role: "B", jobUrl: "https://www.linkedin.com/jobs/view/1", applicationUrl: "https://boards.greenhouse.io/a/jobs/1", applicationRoute: "external" })).toBe("external_application");
  });

  it("classifies Naukri native and external redirects separately", () => {
    expect(classifyApplicationChannel({ source: "naukri", company: "A", role: "B", jobUrl: "https://www.naukri.com/job-listings-1", applicationRoute: "native" })).toBe("native_easy_apply");
    expect(classifyApplicationChannel({ source: "naukri", company: "A", role: "B", jobUrl: "https://www.naukri.com/job-listings-1", applicationUrl: "https://careers.example.com/jobs/1", applicationRoute: "redirect" })).toBe("external_application");
  });

  it("uses one canonical identity for LinkedIn and the official ATS opening", () => {
    const official = "https://boards.greenhouse.io/acme/jobs/42?utm_source=linkedin";
    expect(canonicalOpportunityId({ source: "linkedin", company: "Acme", role: "Backend Engineer", jobUrl: "https://www.linkedin.com/jobs/view/9", applicationUrl: official }))
      .toBe(canonicalOpportunityId({ source: "greenhouse", company: " ACME ", role: "Backend Engineer", jobUrl: "https://boards.greenhouse.io/acme/jobs/42", applicationUrl: official }));
  });

  it("keeps same-titled openings in different locations distinct without a shared official URL", () => {
    const base = { source: "linkedin", company: "Acme", role: "Backend Engineer", jobUrl: "https://www.linkedin.com/jobs/search" };
    expect(canonicalOpportunityId({ ...base, location: "Bengaluru" }))
      .not.toBe(canonicalOpportunityId({ ...base, location: "Hyderabad" }));
  });

  it("routes qualifying native, external, and unknown opportunities to durable queues", () => {
    const root = workspace();
    const coordinator = new DiscoveryCoordinator(root, buildDefaultDiscoveryPlan("RUN-DISCOVERY-FIRST", { sources: ["linkedin"], location: "India" }));
    const base = { company: "Acme", role: "Backend Engineer", jobUrl: "https://www.linkedin.com/jobs/view/1", descriptionReadComplete: true, matchScore: 88, postingAge: "1 day", selectedResume: "resumes/resume.pdf", reasonCodes: ["MATCHED_CANDIDATE_PROFILE"] };
    expect(coordinator.recordOpportunity(makeJobOpportunity({ ...base, source: "linkedin", applicationRoute: "easy_apply" }), { decision: "qualifying" }).route).toBe("native");
    expect(coordinator.recordOpportunity(makeJobOpportunity({ ...base, source: "linkedin", jobUrl: "https://www.linkedin.com/jobs/view/2", applicationUrl: "https://jobs.example.com/2", applicationRoute: "external" }), { decision: "qualifying" }).route).toBe("external");
    expect(coordinator.recordOpportunity(makeJobOpportunity({ ...base, source: "linkedin", role: "Platform Engineer", jobUrl: "https://www.linkedin.com/jobs/view/3" }), { decision: "qualifying" }).route).toBe("unknown");
    const queues = new OpportunityQueues(root);
    expect(queues.nativeItems()).toHaveLength(1);
    expect(queues.externalItems()).toHaveLength(1);
    expect(queues.unknownItems()).toHaveLength(1);
    expect(queues.nativeItems()[0].status).toBe("pending");
  });

  it("deduplicates a second source without adding a second queue item", () => {
    const root = workspace();
    const coordinator = new DiscoveryCoordinator(root, buildDefaultDiscoveryPlan("RUN-DISCOVERY-FIRST", { sources: ["linkedin", "greenhouse"], location: "India" }));
    const official = "https://boards.greenhouse.io/acme/jobs/42";
    const first = makeJobOpportunity({ source: "linkedin", company: "Acme", role: "Backend Engineer", jobUrl: "https://www.linkedin.com/jobs/view/9", applicationUrl: official, applicationRoute: "external", descriptionReadComplete: true, matchScore: 90 });
    const second = makeJobOpportunity({ source: "greenhouse", company: "Acme", role: "Backend Engineer", jobUrl: official, applicationUrl: official, applicationRoute: "external", descriptionReadComplete: true, matchScore: 90 });
    expect(first.id).toBe(second.id);
    expect(coordinator.recordOpportunity(first, { decision: "qualifying" }).route).toBe("external");
    expect(coordinator.recordOpportunity(second, { decision: "qualifying" }).route).toBe("duplicate");
    expect(new OpportunityQueues(root).externalItems()).toHaveLength(1);
  });

  it("sorts external review by score and keeps external jobs out of native queue", () => {
    const root = workspace();
    const queues = new OpportunityQueues(root);
    queues.upsertExternal({ opportunityId: "low", company: "A", role: "B", discoverySource: "linkedin", originalJobUrl: "https://www.linkedin.com/jobs/view/1", matchScore: 70, reasonMatched: [], discoveredAt: "2026-08-22T00:00:00Z", queuedAt: "2026-08-22T00:00:00Z", status: "pending_manual" });
    queues.upsertExternal({ opportunityId: "high", company: "C", role: "D", discoverySource: "linkedin", originalJobUrl: "https://www.linkedin.com/jobs/view/2", matchScore: 90, reasonMatched: [], discoveredAt: "2026-08-22T00:00:00Z", queuedAt: "2026-08-22T00:00:00Z", status: "pending_manual" });
    expect(sortExternalForReview(queues.pendingExternal()).map((item) => item.opportunityId)).toEqual(["high", "low"]);
    expect(queues.pendingNative()).toHaveLength(0);
  });

  it("refuses external execution by default", async () => {
    const result = await executeApplication({
      opportunityId: "opp-test",
      company: "Example Company",
      role: "Backend Engineer",
      jobUrl: "https://boards.greenhouse.io/example/jobs/123",
      applicationChannel: "external_application",
      ats: "greenhouse",
      resume: "resumes/resume.pdf",
      candidate: { name: "Test Candidate", email: "candidate@example.com", phone: "+91 0000000000", location: "India" },
      answers: {},
    }, { workspaceRoot: workspace(), dryRun: true });
    expect(result.status).toBe("blocked");
    expect(result.blocker?.message).toContain("manual-first");
  });
});
