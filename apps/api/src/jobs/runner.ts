/* oxlint-disable oxc/no-map-spread -- Preserve immutable database records and React state. */
/* oxlint-disable no-await-in-loop -- Durable job stages persist in order and limit concurrent image generation and memory. */
import { randomUUID } from "node:crypto";

import {
    assets,
    brands,
    campaignItems,
    imageVersions,
    products,
    type Database,
    type CampaignRow,
    type ItemRow,
} from "@repo/db";
import { createLogger } from "@repo/logger";
import { and, eq, inArray, sql, isNull } from "drizzle-orm";
import sharp from "sharp";
const logger = createLogger();

import type { Storage } from "../lib/dependencies";
import { downloadInstagramImage } from "../lib/providers/instagram";
import type { AiService, InstagramService } from "../lib/providers/types";
import { brandsRepo } from "../modules/brands/brands.repo";
import { campaignsRepo } from "../modules/campaigns/campaigns.repo";
import { jobsRepo } from "../modules/jobs/jobs.repo";
import { failJob } from "./fail-job";

export type WorkerServices = {
    storage: Storage;
    ai: AiService;
    instagram: InstagramService;
    pause: (seconds: number) => Promise<void>;
    downloadInstagram?: (url: string) => Promise<Uint8Array>;
};
export function addDays(date: string, days: number) {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}
export async function runJob(db: Database, services: WorkerServices, jobId: string) {
    const jobRepo = jobsRepo(db);
    const job = await jobRepo.get(jobId);
    if (!job) throw new Error("Job not found.");
    if (job.status === "complete") return;
    await jobRepo.update(job.id, { status: "running", error: null });
    async function stage(value: string) {
        await jobRepo.update(jobId, { stage: value });
    }
    const repo = campaignsRepo(db);
    async function generatedAsset(bytes: Uint8Array, versionId: string) {
        const key = `${job!.brandId}/generated/${versionId}.png`;
        await services.storage.put(key, bytes, "image/png");
        const info = await sharp(bytes).metadata();
        const row = (
            await db
                .insert(assets)
                .values({
                    brandId: job!.brandId,
                    key,
                    name: `${versionId}.png`,
                    mimeType: "image/png",
                    bytes: bytes.length,
                    role: "generated",
                    status: "ready",
                    width: info.width,
                    height: info.height,
                })
                .onConflictDoUpdate({ target: assets.key, set: { bytes: bytes.length } })
                .returning()
        )[0];
        if (!row) throw new Error("Generated asset insert failed.");
        await db.update(imageVersions).set({ assetId: row.id }).where(eq(imageVersions.id, versionId));
        return row;
    }
    async function references(campaign: CampaignRow) {
        if (!campaign.referenceSnapshot.length) return [];
        const files = await db
            .select()
            .from(assets)
            .where(
                and(
                    eq(assets.brandId, campaign.brandId),
                    inArray(
                        assets.id,
                        campaign.referenceSnapshot.map((ref) => ref.id),
                    ),
                ),
            );
        return files.map((file) => ({ ...file, ...campaign.referenceSnapshot.find((ref) => ref.id === file.id) }));
    }
    async function render(
        campaign: CampaignRow,
        item: ItemRow,
        versionId: string,
        editPrompt?: string,
        source?: Uint8Array,
    ) {
        const refs = await references(campaign);
        if (!refs.some((ref) => ref.productId === campaign.productId))
            throw new Error("Product references are no longer available.");
        const preferred = refs.toSorted((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
        const identity = JSON.stringify({ brand: campaign.profileSnapshot, products: campaign.productSnapshot });
        const prompt = editPrompt
            ? `Edit the first image. ${editPrompt}. Preserve all unrequested details and exact product identity from the remaining reference photos. Brand requirements: ${identity}`
            : `Create an Instagram ${item.brief.format} photograph. ${item.brief.scene}. Campaign art direction: ${campaign.plan?.artDirection ?? ""}. Brand requirements: ${identity}. Exact product identity from reference images is mandatory. ${item.brief.headline ? `Render only this headline if it suits the composition: ${item.brief.headline}.` : "Do not add text overlays."} ${item.brief.format === "story" ? "Keep important text and product details within the central 70% vertically for Instagram story UI." : "Compose for a 4:5 feed image."}`;
        let version = await repo.version(versionId);
        if (!version) throw new Error("Image version missing.");
        await db.update(campaignItems).set({ status: "generating" }).where(eq(campaignItems.id, item.id));
        await db
            .update(imageVersions)
            .set({ status: "generating", error: null })
            .where(eq(imageVersions.id, version.id));
        let bytes: Uint8Array;
        if (version.assetId) {
            const asset = (await db.select().from(assets).where(eq(assets.id, version.assetId)))[0];
            if (!asset) throw new Error("Generated image file missing.");
            bytes = await services.storage.read(asset.key);
        } else {
            bytes = await services.ai.image(
                {
                    prompt,
                    format: item.brief.format,
                    includesPerson: item.brief.includesPerson,
                    references: preferred,
                    source,
                },
                jobId,
            );
            await generatedAsset(bytes, version.id);
        }
        await stage(`Checking ${item.brief.title}`);
        if (job?.kind === "campaign")
            await repo.update(campaign.id, { status: "checking", stage: `Checking image ${item.sequence + 1} of 6` });
        await db.update(campaignItems).set({ status: "checking" }).where(eq(campaignItems.id, item.id));
        let quality = await services.ai.check(bytes, preferred, campaign.profileSnapshot, jobId);
        await db
            .update(imageVersions)
            .set({ quality, status: quality.passed ? "ready" : "needs_attention" })
            .where(eq(imageVersions.id, version.id));
        // Keep the original image and the automatic correction as separate, restorable versions.
        if (!quality.passed && !editPrompt) {
            const repairId = randomUUID();
            const last = (await repo.versions(item.id))[0];
            const repairPrompt = `Correct only these issues: ${quality.issues.join("; ")}. Preserve the rest of the image and follow the exact product references.`;
            const repair = (
                await db
                    .insert(imageVersions)
                    .values({
                        id: repairId,
                        itemId: item.id,
                        parentId: version.id,
                        number: (last?.version.number ?? 0) + 1,
                        prompt: repairPrompt,
                        status: "generating",
                    })
                    .returning()
            )[0];
            if (!repair) throw new Error("Repair version insert failed.");
            bytes = await services.ai.image(
                {
                    prompt: repairPrompt,
                    format: item.brief.format,
                    includesPerson: false,
                    references: preferred,
                    source: bytes,
                },
                jobId,
            );
            await generatedAsset(bytes, repair.id);
            quality = await services.ai.check(bytes, preferred, campaign.profileSnapshot, jobId);
            version = repair;
            await db
                .update(imageVersions)
                .set({ quality, status: quality.passed ? "ready" : "needs_attention" })
                .where(eq(imageVersions.id, repair.id));
        }
        await db
            .update(campaignItems)
            .set({
                currentVersionId: version.id,
                status: quality.passed ? "ready" : "needs_attention",
                revision: sql`${campaignItems.revision} + 1`,
            })
            .where(eq(campaignItems.id, item.id));
    }
    try {
        if (job.kind === "instagram") {
            const brand = await brandsRepo(db).byId(job.brandId);
            if (!brand?.instagramUrl) throw new Error("Instagram profile URL is missing.");
            await db
                .update(brands)
                .set({ instagramStatus: "importing", instagramMessage: "Finding public posts" })
                .where(eq(brands.id, brand.id));
            await stage("Finding public Instagram posts");
            let runId = brand.instagramRunId;
            if (!runId) {
                runId = await services.instagram.start(brand.instagramUrl);
                await db.update(brands).set({ instagramRunId: runId }).where(eq(brands.id, brand.id));
            }
            let result = await services.instagram.result(runId);
            for (let attempt = 0; result.status === "running" && attempt < 180; attempt++) {
                await services.pause(10);
                result = await services.instagram.result(runId);
            }
            if (result.status !== "complete") throw new Error(result.message || "The Instagram import did not finish.");
            let imported = 0;
            let skipped = 0;
            const existing = await db
                .select()
                .from(assets)
                .where(and(eq(assets.brandId, brand.id), eq(assets.role, "instagram")));
            const seen = new Set(existing.map((file) => file.sourceId));
            for (const post of result.posts) {
                for (const [index, url] of post.images.entries()) {
                    const sourceId = `${brand.instagramUrl}:${post.id}:${index}`;
                    if (seen.has(sourceId)) {
                        imported++;
                        continue;
                    }
                    try {
                        const original = await (services.downloadInstagram ?? downloadInstagramImage)(url);
                        const normalized = await sharp(original, { limitInputPixels: 40_000_000 })
                            .rotate()
                            .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
                            .webp({ quality: 88 })
                            .toBuffer({ resolveWithObject: true });
                        const id = randomUUID();
                        const key = `${brand.id}/instagram/${id}.webp`;
                        await services.storage.put(key, normalized.data, "image/webp");
                        await db.insert(assets).values({
                            id,
                            brandId: brand.id,
                            key,
                            name: `Instagram ${post.id}`,
                            mimeType: "image/webp",
                            bytes: normalized.data.length,
                            role: "instagram",
                            status: "ready",
                            width: normalized.info.width,
                            height: normalized.info.height,
                            caption: post.caption,
                            sourceUrl: post.url,
                            sourceId,
                        });
                        imported++;
                    } catch {
                        skipped++;
                    }
                }
                await db
                    .update(brands)
                    .set({ instagramCount: imported, instagramMessage: `${imported} images imported` })
                    .where(eq(brands.id, brand.id));
            }
            if (!imported)
                throw new Error("Posts were found but their images could not be downloaded. Try the import again.");
            // Keep the previous library until the replacement import has usable files.
            for (const old of existing.filter((file) => !file.sourceId?.startsWith(`${brand.instagramUrl}:`))) {
                await db.delete(assets).where(eq(assets.id, old.id));
                await services.storage.remove(old.key);
            }
            await db
                .update(brands)
                .set({
                    instagramStatus: result.partial || skipped ? "partial" : "ready",
                    instagramCount: imported,
                    instagramMessage: `${imported} images imported. ${result.message}${skipped ? ` ${skipped} images could not be downloaded.` : ""}`,
                })
                .where(eq(brands.id, brand.id));
        } else if (job.kind === "analysis") {
            const brand = await brandsRepo(db).byId(job.brandId);
            if (!brand) throw new Error("Brand not found.");
            await stage("Reading your guidelines and reference images");
            await db.update(brands).set({ status: "analyzing", error: null }).where(eq(brands.id, brand.id));
            const files = await db
                .select()
                .from(assets)
                .where(
                    and(
                        eq(assets.brandId, brand.id),
                        eq(assets.status, "ready"),
                        sql`${assets.role} != 'generated'`,
                        isNull(assets.deletedAt),
                    ),
                );
            const knownProducts = await db.select().from(products).where(eq(products.brandId, brand.id));
            const analysis = await services.ai.analyze(brand, files, knownProducts, jobId);
            const claimed = new Set<string>();
            for (const group of analysis.groups) {
                const ids = group.assetIds.filter(
                    (id) =>
                        !claimed.has(id) &&
                        files.some((file) => file.id === id && file.role === "product" && !file.productId),
                );
                if (!ids.length) continue;
                const product = (
                    await db
                        .insert(products)
                        .values({
                            brandId: brand.id,
                            name: group.name,
                            description: group.description,
                            packaging: group.packaging,
                        })
                        .returning()
                )[0];
                if (!product) throw new Error("Product grouping failed.");
                await db.update(assets).set({ productId: product.id }).where(inArray(assets.id, ids));
                ids.forEach((id) => claimed.add(id));
            }
            for (const classification of analysis.classification) {
                if (
                    !claimed.has(classification.assetId) &&
                    files.some(
                        (file) => file.id === classification.assetId && file.role === "product" && !file.productId,
                    )
                )
                    await db
                        .update(assets)
                        .set({ role: classification.role })
                        .where(eq(assets.id, classification.assetId));
            }
            await stage("Writing your brand profile");
            const allProducts = await db.select().from(products).where(eq(products.brandId, brand.id));
            const suggestions = allProducts.length
                ? await services.ai.recommend(analysis.profile, allProducts, jobId)
                : [];
            if (suggestions.some((suggestion) => !allProducts.some((product) => product.id === suggestion.productId)))
                throw new Error("Campaign recommendation referenced an unknown product.");
            const sourceIds = new Set(files.map((file) => file.id));
            const fields = [
                analysis.profile.positioning,
                analysis.profile.audience,
                analysis.profile.voice,
                analysis.profile.photography,
                analysis.profile.fonts,
                analysis.profile.productRules,
            ];
            for (const field of fields) {
                field.confirmed = false;
                field.evidence = field.evidence.filter((item) => sourceIds.has(item.sourceId));
            }
            analysis.profile.approvedClaims = analysis.profile.approvedClaims.filter((claim) =>
                claim.evidence.every((evidence) => sourceIds.has(evidence.sourceId)),
            );
            await db
                .update(brands)
                .set({
                    profile: analysis.profile,
                    profileVersion: sql`${brands.profileVersion} + 1`,
                    status: "review",
                    profileConfirmedAt: null,
                    suggestions,
                    suggestionsStatus: suggestions.length ? "ready" : "missing",
                    error: null,
                })
                .where(eq(brands.id, brand.id));
        } else if (job.kind === "recommendations") {
            const brand = await brandsRepo(db).byId(job.brandId);
            if (!brand?.profile || !brand.profileConfirmedAt)
                throw new Error("Confirm your brand before requesting ideas.");
            await stage("Preparing campaign ideas");
            const allProducts = await db.select().from(products).where(eq(products.brandId, brand.id));
            const suggestions = await services.ai.recommend(brand.profile, allProducts, jobId);
            if (suggestions.some((suggestion) => !allProducts.some((product) => product.id === suggestion.productId)))
                throw new Error("A recommendation referenced an unknown product.");
            await db
                .update(brands)
                .set({ suggestions, suggestionsStatus: "ready" })
                .where(and(eq(brands.id, brand.id), eq(brands.profileVersion, brand.profileVersion)));
        } else if (job.kind === "campaign") {
            let campaign = await repo.byId(job.entityId);
            if (!campaign) throw new Error("Campaign not found.");
            if (!campaign.plan) {
                await stage("Planning six posts");
                await repo.update(campaign.id, { status: "planning", stage: "Planning your campaign", error: null });
                const files = await references(campaign);
                const allProducts = campaign.productSnapshot.map((product) => ({
                    ...product,
                    brandId: campaign!.brandId,
                    createdAt: new Date(0),
                }));
                const plan = await services.ai.plan(campaign, files, allProducts, jobId);
                if (
                    plan.items.some(
                        (item) =>
                            item.dayOffset >= campaign!.durationDays ||
                            item.referenceIds.some((id) => !files.some((file) => file.id === id)),
                    )
                )
                    throw new Error("The campaign plan contains an invalid date or reference. Please retry.");
                await repo.update(campaign.id, { plan, title: plan.title });
                campaign = { ...campaign, plan, title: plan.title };
            }
            if (!campaign.plan) throw new Error("Campaign plan missing.");
            for (const [sequence, brief] of campaign.plan.items.entries()) {
                await db
                    .insert(campaignItems)
                    .values({
                        campaignId: campaign.id,
                        sequence,
                        brief,
                        caption: brief.caption,
                        publishDate: addDays(campaign.startDate, brief.dayOffset),
                        publishTime: brief.time,
                    })
                    .onConflictDoNothing({ target: [campaignItems.campaignId, campaignItems.sequence] });
            }
            const items = await repo.items(campaign.id);
            let failures = 0;
            for (const [index, item] of items.entries()) {
                if (["ready", "needs_attention"].includes(item.status)) continue;
                await repo.update(campaign.id, {
                    status: "generating",
                    stage: `Creating image ${index + 1} of 6`,
                    error: null,
                });
                await stage(`Creating image ${index + 1} of 6`);
                let version = (await repo.versions(item.id))[0]?.version;
                if (!version)
                    version = (await db.insert(imageVersions).values({ itemId: item.id, number: 1 }).returning())[0];
                if (!version) throw new Error("Image version missing.");
                try {
                    const parent = version.parentId ? await repo.version(version.parentId) : null;
                    const parentAsset = parent?.assetId
                        ? (await db.select().from(assets).where(eq(assets.id, parent.assetId)))[0]
                        : null;
                    await render(
                        campaign,
                        item,
                        version.id,
                        version.prompt ?? undefined,
                        parentAsset ? await services.storage.read(parentAsset.key) : undefined,
                    );
                } catch (error) {
                    failures++;
                    await db
                        .update(imageVersions)
                        .set({
                            status: "failed",
                            error: "This image could not be completed. Retry the campaign to continue.",
                        })
                        .where(
                            and(
                                eq(imageVersions.itemId, item.id),
                                inArray(imageVersions.status, ["queued", "generating", "checking"]),
                            ),
                        );
                    await db.update(campaignItems).set({ status: "failed" }).where(eq(campaignItems.id, item.id));
                    logger.error({ jobId, itemId: item.id, err: error }, "campaign.image.failed");
                }
            }
            const complete = await repo.items(campaign.id);
            if (failures) throw new Error(`${failures} campaign images could not be completed.`);
            const attention = complete.some((item) => item.status === "needs_attention");
            await repo.update(campaign.id, {
                status: attention ? "needs_attention" : "ready",
                stage: attention ? "Review the flagged images" : "Your campaign is ready",
                error: null,
            });
        } else {
            const version = await repo.version(job.entityId);
            if (!version?.parentId || !version.prompt) throw new Error("Edit request not found.");
            const item = (await db.select().from(campaignItems).where(eq(campaignItems.id, version.itemId)))[0];
            const campaign = item ? await repo.byId(item.campaignId) : null;
            const base = await repo.version(version.parentId);
            const source = base?.assetId
                ? (await db.select().from(assets).where(eq(assets.id, base.assetId)))[0]
                : null;
            if (!item || !campaign || !source) throw new Error("The original image is unavailable.");
            await stage("Editing your image");
            await render(campaign, item, version.id, version.prompt, await services.storage.read(source.key));
            const items = await repo.items(campaign.id);
            await repo.update(campaign.id, {
                status: items.some((entry) => entry.status === "needs_attention") ? "needs_attention" : "ready",
            });
        }
        await jobRepo.update(jobId, { status: "complete", stage: "Complete", error: null });
    } catch (error) {
        await failJob(db, jobId, "This step could not finish. Your saved work is safe. Please retry.");
        throw error;
    }
}
