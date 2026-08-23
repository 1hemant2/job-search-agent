import path from "node:path";
import { describe, expect, it } from "vitest";
import { findDuplicate, validateApplicationPayload } from "../src/application-payload.js";
import { JAVA_RESUME_PROFILE, NODE_RESUME_PROFILE } from "../src/search-profiles.js";

const workspaceRoot = path.resolve(process.cwd(), "..");

function payload(overrides: Record<string, unknown> = {}) {
  return {
    company: "Example Company",
    role: "Backend Engineer",
    jobUrl: "https://boards.greenhouse.io/example/jobs/123",
    ats: "greenhouse",
    resume: "resumes/Hemant_Kumar_NodeJS_Resume.pdf",
    candidate: {
      name: "Hemant Kumar",
      email: "meet.hemant.k@gmail.com",
      phone: "+91 9534909390",
      location: "Bengaluru, Karnataka, India",
    },
    answers: {},
    ...overrides,
  };
}

describe("application payload validation", () => {
  it("accepts a source-of-truth resume inside resumes/", () => {
    const result = validateApplicationPayload(payload(), workspaceRoot);
    expect(result.errors).toEqual([]);
    expect(result.payload.resumeProfile).toBe(NODE_RESUME_PROFILE);
  });

  it("rejects mismatched frozen resume metadata", () => {
    const result = validateApplicationPayload(payload({ resumeProfile: JAVA_RESUME_PROFILE }), workspaceRoot);
    expect(result.errors.join(" ")).toContain("does not match selectedResume");
  });

  it("rejects a resume outside the workspace resumes directory", () => {
    const result = validateApplicationPayload(payload({ resume: "AGENTS.md" }), workspaceRoot);
    expect(result.errors).toContain("resume must be inside the workspace resumes directory");
  });

  it("requires an explicit allowlist for a LinkedIn external redirect", () => {
    const result = validateApplicationPayload(payload({
      ats: "linkedin",
      jobUrl: "https://www.linkedin.com/jobs/view/123",
      applicationUrl: "https://jobs.example.com/role",
    }), workspaceRoot);
    expect(result.errors).toContain("allowedApplicationDomains is required for a LinkedIn redirect to another domain");
  });
});

describe("application history deduplication", () => {
  it("deduplicates by URL, job id, or normalized company and role", () => {
    const item = payload({ jobId: "123" });
    expect(findDuplicate(item as never, "- Job URL: https://boards.greenhouse.io/example/jobs/123")).toContain("jobUrl");
    expect(findDuplicate(item as never, "- Job ID: 123")).toContain("jobId");
    expect(findDuplicate(item as never, "## Example Company — Backend Engineer\n- Status: Applied")).toContain("company and role");
  });
});
