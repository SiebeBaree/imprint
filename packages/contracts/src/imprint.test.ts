import { describe, expect, it } from "vitest";

import { createCampaignSchema, instagramUrlSchema, updateItemSchema, uploadSchema } from "./index";
describe("Instagram profile input", () => {
    it("normalizes public profile URLs without retaining tracking queries", () => {
        expect(instagramUrlSchema.parse(" https://instagram.com/lotusbiscoff/?utm_source=test ")).toBe(
            "https://www.instagram.com/lotusbiscoff/",
        );
    });
    it.each([
        "https://www.instagram.com/p/",
        "https://www.instagram.com/reel/abc",
        "http://instagram.com/test",
        "https://instagram.com.evil.test/test",
        "https://user:pass@instagram.com/brand",
        "https://instagram.com:444/brand",
        "https://instagram.com/brand/extra",
        "file:///etc/passwd",
    ])("rejects non-profile URL %s", (value) => {
        expect(instagramUrlSchema.safeParse(value).success).toBe(false);
    });
});
it("applies separate image and PDF limits", () => {
    expect(uploadSchema.safeParse({ name: "photo.png", mimeType: "image/png", size: 21 * 1024 * 1024 }).success).toBe(
        false,
    );
    expect(
        uploadSchema.safeParse({ name: "brand.pdf", mimeType: "application/pdf", size: 24 * 1024 * 1024 }).success,
    ).toBe(true);
    expect(uploadSchema.safeParse({ name: "vector.svg", mimeType: "image/svg+xml", size: 100 }).success).toBe(false);
});
it("rejects invalid calendar dates and time labels", () => {
    const input = {
        brief: "Introduce the spread at breakfast",
        productId: "a2222222-2222-4222-8222-222222222222",
        startDate: "2026-02-30",
    };
    expect(createCampaignSchema.safeParse(input).success).toBe(false);
    expect(
        updateItemSchema.safeParse({
            caption: "Breakfast",
            publishDate: "2026-10-01",
            publishTime: "25:00",
            revision: 0,
        }).success,
    ).toBe(false);
});
