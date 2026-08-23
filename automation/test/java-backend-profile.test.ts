import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDefaultDiscoveryPlan, DiscoveryCoordinator } from "../src/discovery.js";
import { evaluateJavaBackendJob, type JavaJobAssessmentInput } from "../src/matching/java-backend.js";
import { makeJobOpportunity } from "../src/opportunity.js";
import { OpportunityQueues } from "../src/queues.js";
import {
  JAVA_BACKEND_RESUME,
  JAVA_RESUME_PROFILE,
  NODE_BACKEND_RESUME,
  NODE_RESUME_PROFILE,
  selectResumeForJob,
  selectResumeProfileForJob,
} from "../src/search-profiles.js";

const cases: Record<string, JavaJobAssessmentInput> = {
  A: {
    role: "Backend Engineer",
    description: "Build backend services with Java, Spring Boot, PostgreSQL, and Kafka.",
    location: "Bengaluru, India",
    requiredYoe: { minimum: 2, maximum: 2, strict: true, text: "2 years experience" },
    javaRequirement: { level: "core", scope: "general", minimumYears: 2, strict: false, text: "Java + Spring Boot" },
  },
  B: {
    role: "Java Developer",
    description: "Develop Spring Boot services. 3+ years professional Java required.",
    location: "Bengaluru, India",
    requiredYoe: { minimum: 3, strict: true, text: "3+ years" },
    javaRequirement: { level: "required", scope: "professional", minimumYears: 3, strict: true, text: "3+ years professional Java required" },
  },
  C: {
    role: "Software Engineer",
    description: "Backend engineering role. Java preferred. Work with SQL, Redis, and Kubernetes.",
    location: "Remote India",
    requiredYoe: { minimum: 2, strict: true, text: "2+ years backend" },
    javaRequirement: { level: "preferred", scope: "preferred", strict: false, text: "Java preferred" },
  },
  D: {
    role: "Senior Java Engineer",
    description: "Own Java services; 5+ years Java required.",
    location: "Bengaluru, India",
    requiredYoe: { minimum: 5, strict: true, text: "5+ years" },
    javaRequirement: { level: "required", scope: "general", minimumYears: 5, strict: true, text: "5+ years Java" },
  },
  E: {
    role: "Backend Engineer",
    description: "Build Java and Spring Boot services using MySQL, Kafka, and AWS.",
    location: "Bengaluru, India",
    requiredYoe: { minimum: 2, maximum: 2, strict: true, text: "2 years" },
    javaRequirement: { level: "core", scope: "general", strict: false, text: "Java + Spring Boot" },
  },
};

describe("Java backend profile dry-run cases", () => {
  it("Case A scores as a high-fit APPLY and selects the Java resume", () => {
    const result = evaluateJavaBackendJob(cases.A);
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.classification).toBe("APPLY");
    expect(result.resumeProfile).toBe(JAVA_RESUME_PROFILE);
    expect(result.selectedResume).toBe(JAVA_BACKEND_RESUME);
  });

  it("Case B preserves explicit professional Java scope and hard-blocks", () => {
    const result = evaluateJavaBackendJob(cases.B);
    expect(result.classification).toBe("SKIP");
    expect(result.javaExperienceScope).toBe("professional");
    expect(result.reasonCodes).toContain("PROFESSIONAL_JAVA_REQUIRED");
    expect(result.gaps.join(" ")).toContain("no professional/production Java employment");
  });

  it("Case C stays eligible when Java is preferred", () => {
    const result = evaluateJavaBackendJob(cases.C);
    expect(["APPLY", "APPLY_STRETCH"]).toContain(result.classification);
    expect(result.selectedResume).toBe(JAVA_BACKEND_RESUME);
    expect(result.hardBlockers).toEqual([]);
  });

  it("Case D rejects a strict 5+ year senior role", () => {
    const result = evaluateJavaBackendJob(cases.D);
    expect(result.classification).toBe("SKIP");
    expect(result.reasonCodes).toContain("EXPERIENCE_HARD_BLOCKER");
  });

  it("Case E treats MySQL, Kafka, and AWS as transferable rather than blockers", () => {
    const result = evaluateJavaBackendJob(cases.E);
    expect(result.classification).toBe("APPLY");
    expect(result.hardBlockers).toEqual([]);
    expect(result.gaps).toHaveLength(3);
    expect(result.selectedResume).toBe(JAVA_BACKEND_RESUME);
  });
});

describe("Java profile integration", () => {
  it("builds the Java title and location plan without changing the default Node plan", () => {
    const javaPlan = buildDefaultDiscoveryPlan("RUN-JAVA", { sources: ["linkedin"], searchProfile: "java_backend" });
    const nodePlan = buildDefaultDiscoveryPlan("RUN-NODE", { sources: ["linkedin"], location: "India" });
    expect(javaPlan.sources[0].queries.map((item) => item.query)).toContain("Java Backend Engineer");
    expect(javaPlan.sources[0].queries.map((item) => item.query)).toContain("Backend Software Engineer Java");
    expect(javaPlan.sources[0].queries.map((item) => item.location)).toContain("Bengaluru");
    expect(javaPlan.sources[0].queries.map((item) => item.location)).toContain("Remote India");
    expect(nodePlan.sources[0].queries.map((item) => item.query)).toContain("Node.js Backend Engineer");
    expect(nodePlan.sources[0].queries.map((item) => item.query)).toContain("TypeScript Backend Engineer");
  });

  it("does not select Java for incidental mentions or Node roles with Java nice-to-have", () => {
    expect(selectResumeForJob({ role: "Backend Engineer", description: "Integrate with an existing Java service." })).toBe(NODE_BACKEND_RESUME);
    expect(selectResumeForJob({ role: "Node.js Backend Engineer", description: "TypeScript is core; Java is nice to have.", searchProfile: "java_backend" })).toBe(NODE_BACKEND_RESUME);
    expect(selectResumeForJob({ role: "Software Engineer", description: "Backend role; Java preferred with SQL and Redis." })).toBe(JAVA_BACKEND_RESUME);
  });

  it("uses profile scores for a genuinely mixed Node.js and Java role and defaults ties to Node.js", () => {
    const mixed = { role: "Node.js and Java Backend Engineer", description: "Build TypeScript and Spring Boot services." };
    expect(selectResumeProfileForJob({ ...mixed, profileScores: { [NODE_RESUME_PROFILE]: 78, [JAVA_RESUME_PROFILE]: 82 } })).toBe(JAVA_RESUME_PROFILE);
    expect(selectResumeProfileForJob({ ...mixed, profileScores: { [NODE_RESUME_PROFILE]: 82, [JAVA_RESUME_PROFILE]: 82 } })).toBe(NODE_RESUME_PROFILE);
  });

  it("persists Java evaluation fields into the ledger and profile-filterable queues", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "java-profile-"));
    fs.mkdirSync(path.join(root, "state"), { recursive: true });
    fs.writeFileSync(path.join(root, "state", "run-state.md"), "# Run State\n\n## Active Run\n\n- Run ID: RUN-JAVA-PERSIST\n", "utf8");
    const result = evaluateJavaBackendJob(cases.A);
    const coordinator = new DiscoveryCoordinator(root, {
      runId: "RUN-JAVA-PERSIST",
      searchProfile: "java_backend",
      sources: [{ source: "linkedin", queries: [{ query: "Java Backend Engineer", queryVariant: "java-backend-engineer" }] }],
    });
    const opportunity = makeJobOpportunity({
      source: "linkedin",
      company: "Example Product Co",
      role: cases.A.role,
      jobUrl: "https://www.linkedin.com/jobs/view/123",
      applicationRoute: "easy_apply",
      location: cases.A.location,
      description: cases.A.description,
      descriptionReadComplete: true,
      postingAge: "1 day",
      matchScore: result.score,
      matchClassification: result.classification,
      searchProfile: "java_backend",
      resumeProfile: result.resumeProfile,
      selectedResume: result.selectedResume,
      requiredYoe: result.requiredYoe,
      javaSpringRequirement: result.javaRequirement,
      javaExperienceScope: result.javaExperienceScope,
      whyCandidateMatches: result.whyCandidateMatches,
      gaps: result.gaps,
      reasonCodes: result.reasonCodes,
    });
    expect(coordinator.recordOpportunity(opportunity, { decision: "apply", recencyClass: "within_window" }).route).toBe("native");
    const queue = new OpportunityQueues(root);
    expect(queue.pendingNative("java_backend")).toHaveLength(1);
    expect(queue.pendingNative("node_backend")).toHaveLength(0);
    expect(queue.pendingNative("java_backend")[0].selectedResume).toBe(JAVA_BACKEND_RESUME);
    expect(queue.pendingNative("java_backend")[0].resumeProfile).toBe(JAVA_RESUME_PROFILE);
    const ledger = fs.readFileSync(path.join(root, "state", "runs", "RUN-JAVA-PERSIST", "discovery-ledger.jsonl"), "utf8");
    expect(ledger).toContain('"search_profile":"java_backend"');
    expect(ledger).toContain('"java_experience_scope":"general"');
    expect(ledger).toContain('"match_classification":"APPLY"');
    expect(ledger).toContain('"resume_profile":"hemant_kumar_java_resume"');
  });
});
