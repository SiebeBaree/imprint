import { expect, test } from "@playwright/test";

import { campaignSchema } from "../packages/contracts/src/campaigns";
const campaignPath = `/campaigns/${process.env.E2E_CAMPAIGN_ID}`;
test("review, edit, restore and download a real campaign", async ({ page }) => {
    const violations: string[] = [];
    const errors: string[] = [];
    page.on("console", (message) => {
        if (/Content Security Policy|violates.*directive/i.test(message.text())) violations.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    const loaded = page.waitForResponse(
        (response) => response.url().endsWith(campaignPath) && response.request().resourceType() === "fetch",
    );
    await page.goto(campaignPath);
    const campaign = campaignSchema.parse(await (await loaded).json());
    const original = campaign.items[0]!;
    const originalVersion = original.versions.find((version) => version.id === original.currentVersionId)!;
    const caption = `${original.caption}\n\nLive edit verification.`;
    await expect(page.locator(".campaign-image").first()).toBeVisible();
    await expect(page.locator(".campaign-image")).toHaveCount(6);
    await expect
        .poll(() =>
            page
                .locator(".campaign-image-preview img")
                .evaluateAll((images) =>
                    images.every(
                        (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
                    ),
                ),
        )
        .toBe(true);
    await page.getByRole("button", { name: "Posting schedule" }).click();
    await expect(page.getByRole("heading", { name: "Posting schedule" })).toBeVisible();
    await page.locator(".schedule-row").first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Caption & schedule" }).click();
    await dialog.getByLabel("Instagram caption").fill(caption);
    await dialog.getByLabel("Time", { exact: true }).fill("16:00");
    await dialog.getByRole("button", { name: "Save caption & schedule" }).click();
    await expect(page.getByText("Post updated.", { exact: true })).toBeVisible();
    await dialog.getByRole("tab", { name: "Image", exact: true }).click();
    await dialog
        .getByLabel("What would you like to change?")
        .fill("Make the background lighting slightly warmer. Keep the product, label and composition unchanged.");
    await dialog.getByRole("button", { name: "Apply image edit" }).click();
    await expect(dialog.getByRole("button", { name: "Compare", exact: true })).toBeVisible({ timeout: 900_000 });
    await dialog.getByRole("button", { name: "Versions", exact: true }).click();
    await dialog.getByRole("button", { name: new RegExp(`Version ${originalVersion.number}\\b`) }).click();
    await dialog.getByRole("button", { name: "Use this version" }).click();
    await expect(page.getByText("Version restored.", { exact: true })).toBeVisible();
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Download image" }).click();
    expect((await download).suggestedFilename()).toMatch(/\.png$/);
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.reload();
    await page.locator(".campaign-image").first().click();
    await expect(page.getByRole("dialog").getByText(caption, { exact: true })).toBeVisible();
    await dialog.getByRole("tab", { name: "Caption & schedule" }).click();
    await dialog.getByLabel("Instagram caption").fill(original.caption);
    await dialog.getByLabel("Time", { exact: true }).fill(original.publishTime);
    await dialog.getByRole("button", { name: "Save caption & schedule" }).click();
    await expect(page.getByText("Post updated.", { exact: true })).toBeVisible();
    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
});
test("the workspace and image editor fit a 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(campaignPath);
    await expect(page.locator(".campaign-image").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator(".campaign-image").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("link", { name: "References", exact: true })).toBeVisible();
});
