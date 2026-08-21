import path from "node:path";
import { createBrowserSession } from "./src/browser.ts";

const workspaceRoot = path.resolve(process.cwd(), "..");
const browser = await createBrowserSession({ workspaceRoot, headless: false, timeoutMs: 30_000 });
await browser.page.goto(
  "https://genesys.wd1.myworkdayjobs.com/en-US/Genesys/job/Virtual-Office-(Tamil-Nadu)/Software-Engineer_JR112053-1/apply/autofillWithResume?source=Linkedin1",
  { waitUntil: "domcontentloaded" },
);
await browser.page.waitForTimeout(180_000);
await browser.close();
