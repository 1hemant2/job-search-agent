import fs from "node:fs";
import path from "node:path";
import { createBrowserSession } from "./browser.js";
import { runAuthenticationAudit, type AuthAuditTarget } from "./auth-audit.js";

interface CliArgs {
  configPath?: string;
  headless: boolean;
  profileDir?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { headless: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--headful") args.headless = false;
    else if (arg === "--config") args.configPath = argv[++index];
    else if (arg === "--profile-dir") args.profileDir = argv[++index];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.configPath) {
  console.error("Usage: npm run auth-audit -- --config path/to/auth-audit.json [--headful] [--profile-dir path]");
  process.exitCode = 2;
} else {
  const workspaceRoot = path.resolve(process.cwd(), "..");
  const config = JSON.parse(fs.readFileSync(path.resolve(args.configPath), "utf8")) as AuthAuditTarget;
  const browser = await createBrowserSession({
    headless: args.headless,
    profileDir: args.profileDir,
    workspaceRoot,
  });
  try {
    const report = await runAuthenticationAudit(browser.page, config);
    console.log(JSON.stringify(report, null, 2));
    if (report.findings.some((finding) => finding.severity === "high")) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
