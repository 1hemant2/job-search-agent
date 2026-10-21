import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findDuplicate, validateApplicationPayload } from "../src/application-payload.js";
import { PRIMARY_RESUME_PROFILE, SPECIALIZED_RESUME_PROFILE } from "../src/search-profiles.js";

const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "payload-workspace-"));
fs.mkdirSync(path.join(workspaceRoot, "candidate", "resumes"), { recursive: true });
fs.writeFileSync(path.join(workspaceRoot, "candidate", "resumes", "primary.pdf"), "fixture");
fs.writeFileSync(path.join(workspaceRoot, "candidate", "resumes", "specialized.pdf"), "fixture");

function payload(overrides: Record<string, unknown> = {}) {
  return {
    company: "Example Company",
    role: "Backend Engineer",
    jobUrl: "https://boards.greenhouse.io/example/jobs/123",
    ats: "greenhouse",
    resume: "candidate/resumes/primary.pdf",
    candidate: {
      name: "Example Candidate",
      email: "candidate@example.test",
      phone: "+1 0000000000",
      location: "Remote",
    },
    answers: {},
    ...overrides,
  };
}

describe("application payload validation", () => {
  it("accepts a source-of-truth resume inside candidate/resumes/", () => {
    const result = validateApplicationPayload(payload(), workspaceRoot);
    expect(result.errors).toEqual([]);
    expect(result.payload.resumeProfile).toBe(PRIMARY_RESUME_PROFILE);
  });

  it("rejects mismatched frozen resume metadata", () => {
    const result = validateApplicationPayload(payload({ resumeProfile: SPECIALIZED_RESUME_PROFILE }), workspaceRoot);
    expect(result.errors.join(" ")).toContain("does not match selectedResume");
  });

  it("rejects a resume outside candidate/resumes", () => {
    const result = validateApplicationPayload(payload({ resume: "AGENTS.md" }), workspaceRoot);
    expect(result.errors).toContain("resume must be inside candidate/resumes");
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
