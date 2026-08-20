import type { Locator } from "playwright";
import { BaseAtsAdapter } from "./base.js";

export class GreenhouseAdapter extends BaseAtsAdapter {
  readonly name = "greenhouse" as const;

  matchesUrl(url: string): boolean {
    try { const host = new URL(url).hostname; return host.includes("greenhouse.io") || host.includes("greenhouse.com"); } catch { return false; }
  }

  protected async finalSubmitControl(): Promise<Locator | undefined> {
    const candidate = this.page.getByRole("button", { name: /submit application/i }).first();
    return await candidate.count() && await candidate.isVisible().catch(() => false) ? candidate : undefined;
  }
}
