import type { Locator } from "playwright";
import { BaseAtsAdapter } from "./base.js";

export class GenericAdapter extends BaseAtsAdapter {
  readonly name = "generic" as const;

  matchesUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    } catch { return false; }
  }

  protected async finalSubmitControl(): Promise<Locator | undefined> {
    // Conservative by design: only an exact, adapter-owned accessible name is allowed.
    const candidate = this.page.getByRole("button", { name: /^submit application$/i }).first();
    return await candidate.count() && await candidate.isVisible().catch(() => false) ? candidate : undefined;
  }
}
