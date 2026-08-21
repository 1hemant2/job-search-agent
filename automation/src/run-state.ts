import fs from "node:fs";
import path from "node:path";
import type { DiscoveryState } from "./discovery-ledger.js";

export interface DiscoveryRunStateSummary {
  runId: string;
  discoveryState: DiscoveryState;
  queriesCompleted: number;
  queriesPlanned: number;
  sourcesCompleted: number;
  sourcesPlanned: number;
  jobsDiscovered: number;
  uniqueJobsEvaluated: number;
  activeQuery?: string;
  nextCursorOrPage?: string;
  discoveryLedger: string;
  searchTelemetry: string;
  executorTelemetry: string;
}

function replaceOrInsert(text: string, label: string, value: string): string {
  const pattern = new RegExp(`^- ${label.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}:.*$`, "m");
  const line = `- ${label}: ${value}`;
  if (pattern.test(text)) return text.replace(pattern, line);
  return `${text.trimEnd()}\n${line}\n`;
}

export function updateDiscoveryRunState(workspaceRoot: string, summary: DiscoveryRunStateSummary): void {
  const statePath = path.join(workspaceRoot, "state", "run-state.md");
  let text = fs.existsSync(statePath) ? fs.readFileSync(statePath, "utf8") : "# Run State\n\n## Active Run\n";
  const runIdPattern = new RegExp(`^- Run ID: ${summary.runId.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}$`, "m");
  if (!runIdPattern.test(text)) {
    throw new Error(`Active run ${summary.runId} is not present in state/run-state.md`);
  }

  const values: Array<[string, string]> = [
    ["Discovery state", summary.discoveryState],
    ["Queries completed", `${summary.queriesCompleted}/${summary.queriesPlanned}`],
    ["Sources completed", `${summary.sourcesCompleted}/${summary.sourcesPlanned}`],
    ["Jobs discovered", String(summary.jobsDiscovered)],
    ["Unique jobs evaluated", String(summary.uniqueJobsEvaluated)],
    ["Active query", summary.activeQuery ?? "none"],
    ["Next cursor/page", summary.nextCursorOrPage ?? "none"],
    ["Discovery ledger", summary.discoveryLedger],
    ["Search telemetry", summary.searchTelemetry],
    ["Executor telemetry", summary.executorTelemetry],
  ];

  for (const [label, value] of values) {
    const activeSectionStart = text.indexOf("## Active Run");
    const nextSection = text.indexOf("\n## ", activeSectionStart + 1);
    const end = nextSection < 0 ? text.length : nextSection;
    const active = text.slice(activeSectionStart, end);
    const updated = replaceOrInsert(active, label, value);
    text = `${text.slice(0, activeSectionStart)}${updated}${text.slice(end)}`;
  }
  const activeSectionStart = text.indexOf("## Active Run");
  const nextSection = text.indexOf("\n## ", activeSectionStart + 1);
  const activeEnd = nextSection < 0 ? text.length : nextSection;
  const active = text.slice(activeSectionStart, activeEnd);
  const status = summary.discoveryState === "SEARCH_SPACE_REASONABLY_EXHAUSTED"
    ? "terminal - search space reasonably exhausted"
    : "running - discovery continues";
  const lifecycle = summary.discoveryState === "SEARCH_SPACE_REASONABLY_EXHAUSTED" ? "stopped" : "discovering";
  const withStatus = replaceOrInsert(active, "Status", status);
  const withLifecycle = replaceOrInsert(withStatus, "Lifecycle state", lifecycle);
  text = `${text.slice(0, activeSectionStart)}${withLifecycle}${text.slice(activeEnd)}`;
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, text.trimEnd() + "\n", "utf8");
}
