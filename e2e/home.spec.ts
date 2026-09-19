import { expect, test } from "@playwright/test";

test("the home page renders and links to the todos page", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
        if (message.text().includes("Content Security Policy")) violations.push(message.text());
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Todos" })).toBeVisible();
    await expect(page.getByRole("link", { name: /open todos/i })).toBeVisible();
    expect(violations).toEqual([]);
});

// The meta tag is injected by scripts/inject-csp.mjs after the build. If this fails, treat it as a release blocker.
test("the built page carries a strict hash-based CSP", async ({ page }) => {
    await page.goto("/");
    const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");

    expect(policy).toBeTruthy();
    expect(policy).toContain("'strict-dynamic'");
    expect(policy).toContain("'sha256-");
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).not.toMatch(/(^|[\s;])\*/);
});
