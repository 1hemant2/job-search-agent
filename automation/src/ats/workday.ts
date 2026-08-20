import type { Locator } from "playwright";
import { BaseAtsAdapter } from "./base.js";

export class WorkdayAdapter extends BaseAtsAdapter {
  readonly name = "workday" as const;

  matchesUrl(url: string): boolean {
    try { const host = new URL(url).hostname; return host.includes("myworkdayjobs.com") || host.includes("workday.com"); } catch { return false; }
  }

  protected async finalSubmitControl(): Promise<Locator | undefined> {
    const candidate = this.page.getByRole("button", { name: /submit application|submit/i }).last();
    return await candidate.count() && await candidate.isVisible().catch(() => false) ? candidate : undefined;
  }
}
