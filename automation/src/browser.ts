import fs from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { isAllowedNavigation } from "./application-payload.js";
import type { ApplicationPayload, BrowserOptions } from "./types.js";

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
  close(): Promise<void>;
}

export function localExecutablePath(): string | undefined {
  const configured = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  if (configured && fs.existsSync(configured)) return configured;
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

export async function createBrowserSession(
  options: BrowserOptions & { workspaceRoot?: string } = {},
): Promise<BrowserSession> {
  const workspaceRoot = options.workspaceRoot ?? path.resolve(process.cwd(), "..");
  const profileDir = options.profileDir ?? path.join(workspaceRoot, "automation", ".profile");
  fs.mkdirSync(profileDir, { recursive: true });

  try {
    const context = await chromium.launchPersistentContext(profileDir, {
      headless: options.headless ?? true,
      timeout: options.timeoutMs ?? 30_000,
      acceptDownloads: true,
      executablePath: localExecutablePath(),
    });
    const page = context.pages()[0] ?? await context.newPage();
    page.setDefaultTimeout(options.timeoutMs ?? 15_000);
    return { context, page, close: () => context.close() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to launch the local Playwright browser. Install a browser with 'npx playwright install chromium'. ${message}`);
  }
}

export async function safeGoto(page: Page, payload: ApplicationPayload, url: string): Promise<void> {
  if (!isAllowedNavigation(payload, url)) throw new Error(`unsafe navigation target: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (!isAllowedNavigation(payload, page.url())) throw new Error(`navigation left the allowlist: ${page.url()}`);
}

export function navigationIsAllowed(payload: ApplicationPayload, url: string): boolean {
  return isAllowedNavigation(payload, url);
}
