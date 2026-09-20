import { randomUUID } from "node:crypto";

import {
    brandSchema,
    campaignSchema,
    jobSchema,
    uploadTicketSchema,
    assetSchema,
    productSchema,
} from "@repo/contracts";
import { assets, brands, campaigns, campaignItems, imageVersions, jobs, products } from "@repo/db";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { failJob } from "../jobs/fail-job";
import { runJob, addDays, type WorkerServices } from "../jobs/runner";
import { buildTestApp } from "../test/build-app";
import { testProfile, testPlan } from "../test/fixtures";

let harness: Awaited<ReturnType<typeof buildTestApp>>;
const headers = { authorization: "Bearer test-alice" };
beforeAll(async () => {
    harness = await buildTestApp();
});
beforeEach(async () => {
    vi.restoreAllMocks();
    await harness.reset();
    harness.services.objects.clear();
});
afterAll(async () => {
    await harness.close();
});
async function readyBrand() {
    const response = await harness.app.inject({ method: "GET", url: "/brand", headers });
    const brand = brandSchema.parse(response.json());
    await harness.db
        .update(brands)
        .set({
            name: "Test brand",
            instagramStatus: "ready",
            status: "ready",
            profile: testProfile,
            profileVersion: 1,
            profileConfirmedAt: new Date(),
        })
        .where(eq(brands.id, brand.id));
    const product = (await harness.db.insert(products).values({ brandId: brand.id, name: "Spread" }).returning())[0]!;
    const photo = new Uint8Array(
        await sharp({ create: { width: 256, height: 256, channels: 3, background: "#e0c6a3" } })
            .png()
            .toBuffer(),
    );
    const ref = (
        await harness.db
            .insert(assets)
            .values({
                brandId: brand.id,
                name: "jar.png",
                key: `${brand.id}/photo`,
                mimeType: "image/png",
                bytes: photo.length,
                role: "product",
                status: "ready",
                productId: product.id,
                isPrimary: true,
            })
            .returning()
    )[0]!;
    await harness.services.storage.put(ref.key, photo, "image/png");
    await harness.db.insert(assets).values({
        brandId: brand.id,
        name: "brand.pdf",
        key: `${brand.id}/pdf`,
        mimeType: "application/pdf",
        bytes: 100,
        role: "guidelines",
        status: "ready",
        extractedText: "Use clear natural photography. Preserve the exact package and red lid.",
    });
    return { brand, product, ref, photo };
}
async function createCampaign(productId: string, key = randomUUID()) {
    return harness.app.inject({
        method: "POST",
        url: "/campaigns",
        headers: { ...headers, "idempotency-key": key },
        payload: {
            brief: "Show this spread in a weekend breakfast",
            productId,
            startDate: "2026-09-19",
            durationDays: 14,
        },
    });
}
function workerFor(refId: string, photo: Uint8Array): WorkerServices {
    return {
        storage: harness.services.storage,
        pause: async () => {},
        instagram: {
            start: async () => "unused",
            result: async () => {
                throw new Error("unused");
            },
        },
        ai: {
            analyze: async () => {
                throw new Error("unused");
            },
            recommend: async () => [],
            plan: async () => testPlan(refId),
            image: async () => photo,
            check: async () => ({ passed: true, issues: [] }),
        },
    };
}
it("requires authentication and isolates every owned resource", async () => {
    expect((await harness.app.inject({ url: "/brand" })).statusCode).toBe(401);
    expect((await harness.app.inject({ url: "/brand", headers: { authorization: "Bearer invalid" } })).statusCode).toBe(
        401,
    );
    const { product, ref } = await readyBrand();
    const campaign = campaignSchema.parse((await createCampaign(product.id)).json());
    const other = { authorization: "Bearer test-bob" };
    expect((await harness.app.inject({ url: `/campaigns/${campaign.id}`, headers: other })).statusCode).toBe(404);
    expect((await harness.app.inject({ method: "DELETE", url: `/assets/${ref.id}`, headers: other })).statusCode).toBe(
        404,
    );
    expect(
        (
            await harness.app.inject({
                method: "PATCH",
                url: `/products/${product.id}`,
                headers: other,
                payload: { name: "Stolen" },
            })
        ).statusCode,
    ).toBe(404);
    expect((await harness.app.inject({ url: "/assets", headers: other })).json()).toEqual([]);
});
it("reserves at most 50 images under concurrent requests", async () => {
    const { brand } = await readyBrand();
    await harness.db.update(brands).set({ imageCount: 49 }).where(eq(brands.id, brand.id));
    const responses = await Promise.all(
        Array.from({ length: 3 }, () =>
            harness.app.inject({
                method: "POST",
                url: "/assets/upload",
                headers,
                payload: { name: "photo.png", mimeType: "image/png", size: 500 },
            }),
        ),
    );
    expect(responses.map((response) => response.statusCode).toSorted()).toEqual([201, 409, 409]);
    const ticket = uploadTicketSchema.parse(responses.find((response) => response.statusCode === 201)!.json());
    expect(
        (await harness.app.inject({ method: "DELETE", url: `/assets/${ticket.asset.id}`, headers })).statusCode,
    ).toBe(204);
    const [row] = await harness.db.select().from(brands).where(eq(brands.id, brand.id));
    expect(row?.imageCount).toBe(49);
});
it("validates bytes before making uploads ready and normalizes real images", async () => {
    const { photo } = await readyBrand();
    const response = await harness.app.inject({
        method: "POST",
        url: "/assets/upload",
        headers,
        payload: { name: "photo.png", mimeType: "image/png", size: photo.length },
    });
    const ticket = uploadTicketSchema.parse(response.json());
    const [row] = await harness.db.select().from(assets).where(eq(assets.id, ticket.asset.id));
    await harness.services.storage.put(row!.key, photo, "image/png");
    const completed = await harness.app.inject({ method: "POST", url: `/assets/${ticket.asset.id}/complete`, headers });
    expect(completed.statusCode).toBe(200);
    expect(assetSchema.parse(completed.json())).toMatchObject({
        status: "ready",
        mimeType: "image/webp",
        width: 256,
        height: 256,
    });
    const bad = uploadTicketSchema.parse(
        (
            await harness.app.inject({
                method: "POST",
                url: "/assets/upload",
                headers,
                payload: { name: "fake.png", mimeType: "image/png", size: 50 },
            })
        ).json(),
    );
    const [badRow] = await harness.db.select().from(assets).where(eq(assets.id, bad.asset.id));
    await harness.services.storage.put(badRow!.key, new Uint8Array(12), "image/png");
    expect(
        (await harness.app.inject({ method: "POST", url: `/assets/${bad.asset.id}/complete`, headers })).statusCode,
    ).toBe(400);
});
it("prevents stale profile writes and snapshots the confirmed profile", async () => {
    await readyBrand();
    const changed = {
        ...testProfile,
        voice: { ...testProfile.voice, value: "Plain and concise", confirmed: true },
    };
    const payload = { profile: changed, version: 1 };
    expect((await harness.app.inject({ method: "PATCH", url: "/brand/profile", headers, payload })).statusCode).toBe(
        200,
    );
    expect((await harness.app.inject({ method: "PATCH", url: "/brand/profile", headers, payload })).statusCode).toBe(
        409,
    );
    expect(
        (await harness.app.inject({ method: "POST", url: "/brand/confirm", headers, payload: { version: 1 } }))
            .statusCode,
    ).toBe(409);
    expect(
        (await harness.app.inject({ method: "POST", url: "/brand/confirm", headers, payload: { version: 2 } }))
            .statusCode,
    ).toBe(200);
});
it("deduplicates campaign creation and freezes its product references", async () => {
    const { product, ref } = await readyBrand();
    const key = randomUUID();
    const first = campaignSchema.parse((await createCampaign(product.id, key)).json());
    const second = campaignSchema.parse((await createCampaign(product.id, key)).json());
    expect(first.id).toBe(second.id);
    expect(await harness.db.select().from(jobs)).toHaveLength(1);
    const [row] = await harness.db.select().from(campaigns);
    expect(row?.referenceSnapshot).toEqual([{ id: ref.id, productId: product.id, isPrimary: true }]);
    expect(row?.productSnapshot[0]?.name).toBe("Spread");
    expect((await harness.app.inject({ method: "DELETE", url: `/assets/${ref.id}`, headers })).statusCode).toBe(204);
    expect(harness.services.objects.has(ref.key)).toBe(true);
    expect((await harness.app.inject({ url: "/assets", headers })).json()).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ id: ref.id })]),
    );
});
it("creates six posts, edits an image and restores the original without changing its caption", async () => {
    const { product, ref, photo } = await readyBrand();
    const campaign = campaignSchema.parse((await createCampaign(product.id)).json());
    const worker = workerFor(ref.id, photo);
    await runJob(harness.db, worker, campaign.jobId!);
    const complete = campaignSchema.parse(
        (await harness.app.inject({ url: `/campaigns/${campaign.id}`, headers })).json(),
    );
    expect(complete.status).toBe("ready");
    expect(complete.items).toHaveLength(6);
    const item = complete.items[0]!;
    expect(item.publishTime).toBe("09:00");
    const caption = "A caption written by the user.";
    const saved = await harness.app.inject({
        method: "PATCH",
        url: `/campaigns/${campaign.id}/items/${item.id}`,
        headers,
        payload: { caption, publishDate: "2026-10-01", publishTime: "16:00", revision: item.revision },
    });
    expect(saved.statusCode).toBe(200);
    const editRequest = await harness.app.inject({
        method: "POST",
        url: `/campaigns/${campaign.id}/items/${item.id}/edit`,
        headers,
        payload: { prompt: "Move the jar left.", baseVersionId: item.currentVersionId },
    });
    expect(editRequest.statusCode).toBe(202);
    const concurrent = await harness.app.inject({
        method: "POST",
        url: `/campaigns/${campaign.id}/items/${item.id}/edit`,
        headers,
        payload: { prompt: "Move the jar right.", baseVersionId: item.currentVersionId },
    });
    expect(concurrent.statusCode).toBe(409);
    await runJob(harness.db, worker, jobSchema.parse(editRequest.json()).id);
    const [edited] = await harness.db.select().from(campaignItems).where(eq(campaignItems.id, item.id));
    expect(edited?.currentVersionId).not.toBe(item.currentVersionId);
    expect(edited?.caption).toBe(caption);
    const restored = await harness.app.inject({
        method: "POST",
        url: `/campaigns/${campaign.id}/items/${item.id}/restore`,
        headers,
        payload: { versionId: item.currentVersionId },
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ caption, currentVersionId: item.currentVersionId, publishTime: "16:00" });
    const versions = await harness.db.select().from(imageVersions).where(eq(imageVersions.itemId, item.id));
    expect(versions).toHaveLength(2);
});
it("requires a confirmed brand and a reference for the chosen product", async () => {
    const brand = brandSchema.parse((await harness.app.inject({ url: "/brand", headers })).json());
    const product = productSchema.parse(
        (await harness.app.inject({ method: "POST", url: "/products", headers, payload: { name: "No photo" } })).json(),
    );
    expect((await createCampaign(product.id)).statusCode).toBe(409);
    await harness.db
        .update(brands)
        .set({ status: "ready", profile: testProfile, profileVersion: 1, profileConfirmedAt: new Date() })
        .where(eq(brands.id, brand.id));
    expect((await createCampaign(product.id)).statusCode).toBe(409);
});
it("retries only unfinished images after a provider failure", async () => {
    const { product, ref, photo } = await readyBrand();
    const campaign = campaignSchema.parse((await createCampaign(product.id)).json());
    const worker = workerFor(ref.id, photo);
    const generate = vi.fn<typeof worker.ai.image>(worker.ai.image);
    generate.mockRejectedValueOnce(new Error("Provider temporarily unavailable"));
    worker.ai.image = generate;
    await expect(runJob(harness.db, worker, campaign.jobId!)).rejects.toThrow("1 campaign images");
    const failed = campaignSchema.parse(
        (await harness.app.inject({ url: `/campaigns/${campaign.id}`, headers })).json(),
    );
    expect(failed.status).toBe("failed");
    const ready = failed.items.filter((item) => item.status === "ready");
    expect(ready).toHaveLength(5);
    expect(generate).toHaveBeenCalledTimes(6);
    const response = await harness.app.inject({ method: "POST", url: `/campaigns/${campaign.id}/retry`, headers });
    expect(response.statusCode).toBe(200);
    await runJob(harness.db, worker, campaign.jobId!);
    expect(generate).toHaveBeenCalledTimes(7);
    const recovered = campaignSchema.parse(
        (await harness.app.inject({ url: `/campaigns/${campaign.id}`, headers })).json(),
    );
    expect(recovered.status).toBe("ready");
    for (const original of ready)
        expect(recovered.items.find((item) => item.id === original.id)?.currentVersionId).toBe(
            original.currentVersionId,
        );
});
it("resumes a failed quality correction from its original and keeps both versions", async () => {
    const { product, ref, photo } = await readyBrand();
    const campaign = campaignSchema.parse((await createCampaign(product.id)).json());
    const worker = workerFor(ref.id, photo);
    const generate = vi.fn<typeof worker.ai.image>(worker.ai.image);
    generate.mockResolvedValueOnce(photo).mockRejectedValueOnce(new Error("Image edit unavailable"));
    worker.ai.image = generate;
    const check = vi.fn<typeof worker.ai.check>(worker.ai.check);
    check.mockResolvedValueOnce({ passed: false, issues: ["The lid has the wrong color."] });
    worker.ai.check = check;
    await expect(runJob(harness.db, worker, campaign.jobId!)).rejects.toThrow("1 campaign images");
    const failed = campaignSchema.parse(
        (await harness.app.inject({ url: `/campaigns/${campaign.id}`, headers })).json(),
    );
    const first = failed.items[0]!;
    const before = await harness.db.select().from(imageVersions).where(eq(imageVersions.itemId, first.id));
    expect(before.find((version) => version.number === 1)?.status).toBe("needs_attention");
    expect(before.find((version) => version.number === 2)?.status).toBe("failed");
    await harness.app.inject({ method: "POST", url: `/campaigns/${campaign.id}/retry`, headers });
    check.mockResolvedValueOnce({ passed: false, issues: ["Review the label lettering."] });
    await runJob(harness.db, worker, campaign.jobId!);
    expect(generate).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: photo, prompt: expect.stringContaining("The lid has the wrong color.") }),
        campaign.jobId,
    );
    const recovered = campaignSchema.parse(
        (await harness.app.inject({ url: `/campaigns/${campaign.id}`, headers })).json(),
    );
    expect(recovered.status).toBe("needs_attention");
    expect(recovered.items[0]?.status).toBe("needs_attention");
    expect(await harness.db.select().from(imageVersions).where(eq(imageVersions.itemId, first.id))).toHaveLength(2);
});
it("reconciles an expired analysis on refresh and allows a fresh attempt", async () => {
    const { brand } = await readyBrand();
    const queued = jobSchema.parse(
        (await harness.app.inject({ method: "POST", url: "/brand/analyze", headers })).json(),
    );
    await harness.db.update(jobs).set({ updatedAt: new Date(0) }).where(eq(jobs.id, queued.id));
    const message = "The job expired before it could start. Please retry.";
    const failure = vi.spyOn(harness.services, "runFailure").mockResolvedValue(message);
    const response = await harness.app.inject({ url: "/brand", headers });
    expect(response.statusCode).toBe(200);
    expect(brandSchema.parse(response.json())).toMatchObject({ id: brand.id, status: "failed", error: message });
    expect(failure).toHaveBeenCalledWith(`test-run-${queued.id}`);
    expect((await harness.db.select().from(jobs).where(eq(jobs.id, queued.id)))[0]?.status).toBe("failed");
    const retry = await harness.app.inject({ method: "POST", url: "/brand/analyze", headers });
    expect(retry.statusCode).toBe(202);
    expect(jobSchema.parse(retry.json()).id).not.toBe(queued.id);
});
it("keeps active analysis running and limits remote checks during polling", async () => {
    await readyBrand();
    const queued = jobSchema.parse(
        (await harness.app.inject({ method: "POST", url: "/brand/analyze", headers })).json(),
    );
    await harness.db.update(jobs).set({ updatedAt: new Date(0) }).where(eq(jobs.id, queued.id));
    const failure = vi.spyOn(harness.services, "runFailure").mockResolvedValue(null);
    for (let i = 0; i < 2; i++) {
        const response = await harness.app.inject({ url: "/brand", headers });
        expect(brandSchema.parse(response.json()).status).toBe("analyzing");
    }
    expect(failure).toHaveBeenCalledTimes(1);
    expect((await harness.db.select().from(jobs).where(eq(jobs.id, queued.id)))[0]?.status).toBe("queued");
});
it("does not fail an analysis when the run status service is unavailable", async () => {
    await readyBrand();
    const queued = jobSchema.parse(
        (await harness.app.inject({ method: "POST", url: "/brand/analyze", headers })).json(),
    );
    await harness.db.update(jobs).set({ updatedAt: new Date(0) }).where(eq(jobs.id, queued.id));
    vi.spyOn(harness.services, "runFailure").mockRejectedValue(new Error("Trigger unavailable"));
    const response = await harness.app.inject({ url: "/brand", headers });
    expect(response.statusCode).toBe(200);
    expect(brandSchema.parse(response.json())).toMatchObject({ status: "analyzing", error: null });
    expect((await harness.db.select().from(jobs).where(eq(jobs.id, queued.id)))[0]?.status).toBe("queued");
});
it("unblocks an interrupted job without accepting failure callbacks from an older run", async () => {
    const { product } = await readyBrand();
    const campaign = campaignSchema.parse((await createCampaign(product.id)).json());
    await harness.db.update(jobs).set({ status: "running", runId: "current-run" }).where(eq(jobs.id, campaign.jobId!));
    await failJob(harness.db, campaign.jobId!, "Old failure", "old-run");
    expect((await harness.db.select().from(jobs))[0]?.status).toBe("running");
    await failJob(harness.db, campaign.jobId!, "Run interrupted", "current-run");
    expect((await harness.db.select().from(jobs))[0]?.status).toBe("failed");
    expect((await harness.db.select().from(campaigns))[0]?.status).toBe("failed");
    expect(
        (await harness.app.inject({ method: "POST", url: `/campaigns/${campaign.id}/retry`, headers })).statusCode,
    ).toBe(200);
});
it("replaces the primary reference and clears it when an image becomes inspiration", async () => {
    const { brand, product, ref } = await readyBrand();
    const second = (
        await harness.db
            .insert(assets)
            .values({
                brandId: brand.id,
                name: "second.png",
                key: `${brand.id}/second`,
                mimeType: "image/png",
                bytes: 100,
                role: "product",
                status: "ready",
                productId: product.id,
            })
            .returning()
    )[0]!;
    const assign = await harness.app.inject({
        method: "PATCH",
        url: `/assets/${second.id}`,
        headers,
        payload: { role: "product", productId: product.id, isPrimary: true },
    });
    expect(assign.statusCode).toBe(200);
    expect((await harness.db.select().from(assets).where(eq(assets.id, ref.id)))[0]?.isPrimary).toBe(false);
    expect(assetSchema.parse(assign.json()).isPrimary).toBe(true);
    const reclassify = await harness.app.inject({
        method: "PATCH",
        url: `/assets/${second.id}`,
        headers,
        payload: { role: "inspiration", productId: product.id, isPrimary: true },
    });
    expect(reclassify.statusCode).toBe(200);
    expect(assetSchema.parse(reclassify.json())).toMatchObject({ isPrimary: false, productId: null });
});
it("does calendar arithmetic without shifting local posting labels", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
});
