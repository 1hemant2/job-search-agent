import path from "node:path";
import { readPayloadFile } from "../automation/src/application-payload.ts";
import { executeApplication } from "../automation/src/runner.ts";

async function main(): Promise<void> {
  const workspaceRoot = path.resolve(process.cwd(), "..");
  const payload = readPayloadFile(path.join(workspaceRoot, "tmp", "hire-feed-4457059483-payload.json"));
  const result = await executeApplication(payload, {
    workspaceRoot,
    dryRun: false,
    allowSubmit: true,
    headless: false,
    runId: "RUN-20260821-START2-RUN2"
  });
  console.log(JSON.stringify(result, null, 2));
  if (["failed", "blocked", "assessment"].includes(result.status)) process.exitCode = 1;
}

void main();
