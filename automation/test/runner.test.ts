import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { executeApplication } from "../src/runner.js";

const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "executor-workspace-"));
fs.mkdirSync(path.join(workspaceRoot, "candidate", "resumes"), { recursive: true });
fs.writeFileSync(path.join(workspaceRoot, "candidate", "resumes", "primary.pdf"), "fixture");

describe("runner dry-run integration", () => {
  it("navigates and fills a local form without submitting", async () => {
    let submitted = false;
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(`<h1>Example Company — Backend Engineer</h1><form><label>Email <input type="email" required></label><button type="button" aria-label="Submit Application" onclick="fetch('/submitted');">Submit Application</button></form>`);
    });
    server.on("request", (request) => { if (request.url === "/submitted") submitted = true; });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not bind");
    const url = `http://127.0.0.1:${address.port}/apply`;
    const result = await executeApplication({
      company: "Example Company",
      role: "Backend Engineer",
      jobUrl: url,
      ats: "generic",
      resume: "candidate/resumes/primary.pdf",
      candidate: { name: "Example Candidate", email: "candidate@example.test", phone: "+1 0000000000", location: "Remote" },
      answers: {},
    }, { workspaceRoot, dryRun: true, profileDir: path.join(os.tmpdir(), `job-executor-test-${Date.now()}`) });
    server.close();
    expect(result.status).toBe("dry_run");
    expect(result.dryRun).toBe(true);
    expect(submitted).toBe(false);
  }, 20_000);

  it("persists executor telemetry when a run id is supplied", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "executor-telemetry-"));
    fs.mkdirSync(path.join(root, "candidate", "resumes"), { recursive: true });
    fs.writeFileSync(path.join(root, "candidate", "resumes", "primary.pdf"), "fixture");
    let submitted = false;
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(`<h1>Telemetry Company — Backend Engineer</h1><form><label>Email <input type="email" required></label><button type="button" aria-label="Submit Application" onclick="fetch('/submitted');">Submit Application</button></form>`);
    });
    server.on("request", (request) => { if (request.url === "/submitted") submitted = true; });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not bind");
    const url = `http://127.0.0.1:${address.port}/apply`;
    const result = await executeApplication({
      company: "Telemetry Company",
      role: "Backend Engineer",
      jobUrl: url,
      ats: "generic",
      resume: "candidate/resumes/primary.pdf",
      candidate: { name: "Example Candidate", email: "candidate@example.test", phone: "+1 0000000000", location: "Remote" },
      answers: {},
    }, {
      workspaceRoot: root,
      historyPath: path.join(root, "application-history.md"),
      dryRun: true,
      runId: "RUN-EXECUTOR-TELEMETRY",
      profileDir: path.join(root, ".profile"),
      timeoutMs: 2_000,
    });
    server.close();
    expect(result.status).toBe("dry_run");
    expect(result.executorTelemetry?.executor).toBe("local-playwright");
    expect(result.executorTelemetry?.currentPhase).toBe("submit");
    expect(result.executorTelemetry?.startingUrl).toBe(url);
    expect(submitted).toBe(false);
    const telemetryPath = path.join(root, "state", "runs", "RUN-EXECUTOR-TELEMETRY", "executor-telemetry.jsonl");
    const telemetry = JSON.parse(fs.readFileSync(telemetryPath, "utf8").trim());
    expect(telemetry.ats_adapter).toBe("generic");
    expect(telemetry.result_status).toBe("dry_run");
    expect(telemetry.final_url).toContain("127.0.0.1");
  }, 20_000);
});
