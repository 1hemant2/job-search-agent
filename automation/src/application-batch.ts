import fs from "node:fs";
import path from "node:path";
import { OpportunityQueues, type ExternalQueueItem, type NativeQueueItem } from "./queues.js";
import { resolveResumeSelection, type ResumeProfileId } from "./search-profiles.js";
import type { ApplicationChannel } from "./types.js";

export const APPLICATION_BATCH_SCHEMA_VERSION = 1;

export interface FrozenApplicationItem {
  sequence: number;
  runId: string;
  opportunityId: string;
  applicationChannel: Exclude<ApplicationChannel, "unknown">;
  company: string;
  role: string;
  jobUrl: string;
  applicationUrl?: string;
  resumeProfile: ResumeProfileId;
  selectedResume: string;
  matchScore?: number;
  queueStatus: string;
}

export interface ApplicationBatchManifest {
  schemaVersion: number;
  runId: string;
  frozenAt: string;
  stage: "application";
  status: "ready" | "empty";
  items: FrozenApplicationItem[];
}

function frozenItem(
  item: NativeQueueItem | ExternalQueueItem,
  applicationChannel: FrozenApplicationItem["applicationChannel"],
  sequence: number,
): FrozenApplicationItem {
  const selection = resolveResumeSelection(item);
  if (!selection) {
    throw new Error(`Queue item ${item.opportunityId} is missing canonical resume-selection metadata`);
  }
  const native = "jobUrl" in item;
  return {
    sequence,
    runId: item.runId!,
    opportunityId: item.opportunityId,
    applicationChannel,
    company: item.company,
    role: item.role,
    jobUrl: native ? item.jobUrl : item.originalJobUrl,
    applicationUrl: native ? item.applicationUrl : item.externalApplicationUrl,
    ...selection,
    matchScore: item.matchScore,
    queueStatus: item.status,
  };
}

export function freezeApplicationBatch(
  workspaceRoot: string,
  runId: string,
  queues = new OpportunityQueues(workspaceRoot),
): { manifest: ApplicationBatchManifest; path: string } {
  const manifestPath = path.join(workspaceRoot, "state", "runs", runId, "application-batch.json");
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ApplicationBatchManifest;
    if (manifest.runId !== runId) throw new Error(`Frozen batch run ID mismatch in ${manifestPath}`);
    if (manifest.schemaVersion !== APPLICATION_BATCH_SCHEMA_VERSION) {
      throw new Error(`Unsupported frozen batch schema in ${manifestPath}`);
    }
    return { manifest, path: manifestPath };
  }
  const native = queues.nativeItems()
    .filter((item) => item.runId === runId && ["pending", "native_unsupported"].includes(item.status));
  const external = queues.externalItems()
    .filter((item) => item.runId === runId && ["pending", "pending_manual"].includes(item.status));
  const ordered = [
    ...native.map((item) => ({ item, channel: "native_easy_apply" as const })),
    ...external.map((item) => ({ item, channel: "external_application" as const })),
  ].sort((left, right) => left.item.queuedAt.localeCompare(right.item.queuedAt)
    || left.item.opportunityId.localeCompare(right.item.opportunityId));

  const seen = new Set<string>();
  const items = ordered.map(({ item, channel }, index) => {
    if (seen.has(item.opportunityId)) throw new Error(`Duplicate opportunity in frozen batch: ${item.opportunityId}`);
    seen.add(item.opportunityId);
    return frozenItem(item, channel, index + 1);
  });
  const manifest: ApplicationBatchManifest = {
    schemaVersion: APPLICATION_BATCH_SCHEMA_VERSION,
    runId,
    frozenAt: new Date().toISOString(),
    stage: "application",
    status: items.length ? "ready" : "empty",
    items,
  };
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const summaryPath = path.join(workspaceRoot, "state", "runs", runId, "run-summary.json");
  if (fs.existsSync(summaryPath)) {
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8")) as Record<string, unknown>;
    fs.writeFileSync(summaryPath, `${JSON.stringify({
      ...summary,
      workflow_stage: items.length ? "stage_2_ready" : "complete_no_qualifying_jobs",
      application_batch: {
        path: `state/runs/${runId}/application-batch.json`,
        frozen_at: manifest.frozenAt,
        items: items.length,
      },
    }, null, 2)}\n`, "utf8");
  }
  return { manifest, path: manifestPath };
}
