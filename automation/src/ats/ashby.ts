import type { Locator } from "playwright";
import { BaseAtsAdapter } from "./base.js";

export class AshbyAdapter extends BaseAtsAdapter {
  readonly name = "ashby" as const;

  matchesUrl(url: string): boolean {
    try { const host = new URL(url).hostname; return host.includes("ashbyhq.com"); } catch { return false; }
  }

  protected async finalSubmitControl(): Promise<Locator | undefined> {
    const candidate = this.page.getByRole("button", { name: /submit application|submit/i }).last();
    return await candidate.count() && await candidate.isVisible().catch(() => false) ? candidate : undefined;
  }
}
