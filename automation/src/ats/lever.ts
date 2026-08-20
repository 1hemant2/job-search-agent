import type { Locator } from "playwright";
import { BaseAtsAdapter } from "./base.js";

export class LeverAdapter extends BaseAtsAdapter {
  readonly name = "lever" as const;

  matchesUrl(url: string): boolean {
    try { const host = new URL(url).hostname; return host === "jobs.lever.co" || host.endsWith(".lever.co"); } catch { return false; }
  }

  protected async finalSubmitControl(): Promise<Locator | undefined> {
    const candidate = this.page.getByRole("button", { name: /submit application/i }).first();
    return await candidate.count() && await candidate.isVisible().catch(() => false) ? candidate : undefined;
  }
}
