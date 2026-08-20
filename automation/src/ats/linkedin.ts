import type { Locator } from "playwright";
import { BaseAtsAdapter } from "./base.js";

export class LinkedInAdapter extends BaseAtsAdapter {
  readonly name = "linkedin" as const;

  matchesUrl(url: string): boolean {
    try { return new URL(url).hostname.endsWith("linkedin.com"); } catch { return false; }
  }

  protected async finalSubmitControl(): Promise<Locator | undefined> {
    const candidates = [
      this.page.getByRole("button", { name: /submit application/i }).first(),
      this.page.getByRole("button", { name: /^submit$/i }).first(),
    ];
    for (const candidate of candidates) if (await candidate.count() && await candidate.isVisible().catch(() => false)) return candidate;
    return undefined;
  }
}
