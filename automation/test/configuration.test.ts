import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDefaultDiscoveryPlan } from "../src/discovery.js";
import { resolveResumeSelection, selectResumeForJob } from "../src/search-profiles.js";

function configuredWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "configured-profile-"));
  fs.mkdirSync(path.join(root, "candidate", "resumes"), { recursive: true });
  fs.writeFileSync(path.join(root, "candidate", "resumes", "general.pdf"), "fixture");
  fs.writeFileSync(path.join(root, "candidate", "resumes", "data.pdf"), "fixture");
  fs.writeFileSync(path.join(root, "candidate", "resume-profiles.json"), JSON.stringify({
    defaultProfile: "general",
    profiles: [
      { id: "general", path: "candidate/resumes/general.pdf", keywords: ["backend", "go"], queryVariants: [["Backend Engineer", "backend"]], locations: ["Berlin"] },
      { id: "data", path: "candidate/resumes/data.pdf", keywords: ["data", "python"], queryVariants: [["Data Engineer", "data"]], locations: ["Toronto"] },
    ],
    searchProfiles: [
      { id: "general", aliases: ["default"], resumeProfile: "general", queryVariants: [["Backend Engineer", "backend"]], locations: ["Berlin"] },
      { id: "data", aliases: ["data"], resumeProfile: "data", queryVariants: [["Data Engineer", "data"]], locations: ["Toronto"] },
    ],
  }, null, 2));
  return root;
}

describe("private candidate configuration", () => {
  it("loads arbitrary resume IDs and paths without code changes", () => {
    const root = configuredWorkspace();
    expect(resolveResumeSelection({ resumeProfile: "data" }, root)).toEqual({
      resumeProfile: "data",
      selectedResume: "candidate/resumes/data.pdf",
    });
    expect(selectResumeForJob({ role: "Data Engineer", description: "Build Python data pipelines" }, root)).toBe("candidate/resumes/data.pdf");
  });

  it("uses configured search variants and locations", () => {
    const root = configuredWorkspace();
    const plan = buildDefaultDiscoveryPlan("RUN-CONFIG", { sources: ["fixture"], workspaceRoot: root });
    expect(plan.sources[0].queries).toEqual([expect.objectContaining({ query: "Backend Engineer", location: "Berlin" })]);
  });
});
