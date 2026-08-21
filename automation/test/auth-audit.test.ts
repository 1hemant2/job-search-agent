import http from "node:http";
import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import { runAuthenticationAudit } from "../src/auth-audit.js";

describe("read-only authentication audit bridge", () => {
  it("inspects auth surfaces without submitting forms", async () => {
    let postRequests = 0;
    const server = http.createServer((request, response) => {
      if (request.method === "POST") postRequests += 1;
      response.setHeader("content-type", "text/html");
      if (request.url === "/protected") {
        response.end("<h1>Dashboard</h1><p>Private data</p>");
        return;
      }
      response.end(`<h1>Sign in</h1>
        <form method="post" action="/login">
          <label>Email <input type="email" name="email"></label>
          <label>Password <input type="password" name="password" autocomplete="off"></label>
          <button type="submit">Sign in</button>
        </form>
        <a href="/reset">Forgot password</a>`);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not bind");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const report = await runAuthenticationAudit(page, {
      authorized: true,
      baseUrl,
      loginUrl: `${baseUrl}/login`,
      resetUrl: `${baseUrl}/reset?token=redacted-test-token`,
      protectedUrls: [`${baseUrl}/protected`],
    });
    await browser.close();
    server.close();

    expect(report.mode).toBe("read-only");
    expect(report.skill).toBe("authbypass-authentication-flaws");
    expect(report.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      "NO_VISIBLE_CSRF_MARKER",
      "PASSWORD_AUTOCOMPLETE_UNSPECIFIED",
      "SENSITIVE_AUTH_VALUE_IN_URL",
      "PROTECTED_ROUTE_NO_AUTH_WALL",
    ]));
    expect(JSON.stringify(report)).not.toContain("redacted-test-token");
    expect(postRequests).toBe(0);
  }, 20_000);

  it("requires explicit authorization and rejects non-HTTPS remote URLs", async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await (await browser.newContext()).newPage();
    await expect(runAuthenticationAudit(page, {
      authorized: false as true,
      baseUrl: "https://example.com",
      loginUrl: "https://example.com/login",
    })).rejects.toThrow("authorized: true");
    await browser.close();
  });
});
