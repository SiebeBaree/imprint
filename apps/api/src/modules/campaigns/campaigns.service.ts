/* oxlint-disable oxc/no-map-spread -- Preserve immutable database records and React state. */
import { randomUUID } from "node:crypto";

import { campaignSchema, type Campaign, type CreateCampaignInput } from "@repo/contracts";
import { assets, campaignItems, imageVersions, type CampaignRow, type Database, type ItemRow } from "@repo/db";
import { and, eq, sql } from "drizzle-orm";

import type { Dependencies } from "../../lib/dependencies";
import { HttpError, NotFoundError } from "../../lib/errors";
import { brandsRepo } from "../brands/brands.repo";
import { jobsRepo } from "../jobs/jobs.repo";
import { jobsService } from "../jobs/jobs.service";
import { productsRepo } from "../products/products.repo";
import { campaignsRepo } from "./campaigns.repo";

export function campaignsService(db: Database, services: Dependencies) {
    const repo = campaignsRepo(db);
    const tasks = jobsService(db, services);
    async function owned(owner: string, id: string) {
        const brand = await brandsRepo(db).forOwner(owner);
        const row = await repo.get(brand.id, id);
        if (!row) throw new NotFoundError("Campaign not found.");
        return row;
    }
    async function itemResponse(item: ItemRow) {
        const versions = await repo.versions(item.id);
        return {
            id: item.id,
            ...item.brief,
            caption: item.caption,
            publishDate: item.publishDate,
            publishTime: item.publishTime,
            status: item.status,
            currentVersionId: item.currentVersionId,
            revision: item.revision,
            versions: await Promise.all(
                versions.map(async ({ version, asset }) => ({
                    ...version,
                    url: asset ? await services.storage.readUrl(asset.key) : null,
                    createdAt: version.createdAt.toISOString(),
                })),
            ),
        };
    }
    async function response(row: CampaignRow): Promise<Campaign> {
        const items = await Promise.all((await repo.items(row.id)).map(itemResponse));
        const job = await jobsRepo(db).latest(row.brandId, row.id);
        return campaignSchema.parse({
            ...row,
            jobId: job?.id ?? null,
            goal: row.plan?.goal ?? "",
            audience: row.plan?.audience ?? "",
            message: row.plan?.message ?? "",
            readyCount: items.filter((item) => item.status === "ready").length,
            coverUrl:
                items
                    .flatMap((item) =>
                        item.versions
                            .filter((version) => version.id === item.currentVersionId)
                            .map((version) => version.url),
                    )
                    .find(Boolean) ?? null,
            createdAt: row.createdAt.toISOString(),
            items,
        });
    }
    async function ownedItem(owner: string, id: string, itemId: string) {
        const campaign = await owned(owner, id);
        const item = await repo.item(id, itemId);
        if (!item) throw new NotFoundError("Image not found.");
        return { campaign, item };
    }
    return {
        async list(owner: string) {
            const brand = await brandsRepo(db).forOwner(owner);
            await tasks.reconcile(brand.id);
            return Promise.all((await repo.list(brand.id)).map(response));
        },
        async get(owner: string, id: string) {
            const campaign = await owned(owner, id);
            await tasks.reconcile(campaign.brandId);
            return response(await owned(owner, id));
        },
        async create(owner: string, requestKey: string, input: CreateCampaignInput) {
            const brand = await brandsRepo(db).forOwner(owner);
            if (brand.status !== "ready" || !brand.profile || !brand.profileConfirmedAt)
                throw new HttpError(409, "Review and confirm your brand before creating a campaign.");
            const productIds = [...new Set([input.productId, ...input.supportingProductIds])];
            const productRepo = productsRepo(db);
            const refs = await productRepo.references(brand.id);
            const allProducts = await productRepo.list(brand.id);
            for (const id of productIds) {
                if (!allProducts.some((product) => product.id === id)) throw new NotFoundError("Product not found.");
                if (!refs.some((ref) => ref.productId === id))
                    throw new HttpError(409, "Every selected product needs at least one reference photo.");
            }
            const campaignId = randomUUID();
            const selectedProducts = allProducts.filter((product) => productIds.includes(product.id));
            const row = await repo.create({
                ...input,
                referenceSnapshot: refs
                    .filter((ref) => ref.productId && productIds.includes(ref.productId))
                    .map(({ id, productId, isPrimary }) => ({ id, productId, isPrimary })),
                productSnapshot: selectedProducts.map(({ id, name, description, packaging }) => ({
                    id,
                    name,
                    description,
                    packaging,
                })),
                id: campaignId,
                brandId: brand.id,
                requestKey,
                profileSnapshot: brand.profile,
                profileVersion: brand.profileVersion,
            });
            if (row.id === campaignId) {
                try {
                    await tasks.start(brand.id, "campaign", row.id);
                } catch (error) {
                    await repo.update(row.id, {
                        status: "failed",
                        error: "The campaign could not start. Please retry.",
                    });
                    throw error;
                }
            }
            return response(row);
        },
        async updateItem(
            owner: string,
            id: string,
            itemId: string,
            input: { caption: string; publishDate: string; publishTime: string; revision: number },
        ) {
            await ownedItem(owner, id, itemId);
            const item = (
                await db
                    .update(campaignItems)
                    .set({ ...input, revision: input.revision + 1 })
                    .where(and(eq(campaignItems.id, itemId), eq(campaignItems.revision, input.revision)))
                    .returning()
            )[0];
            if (!item) throw new HttpError(409, "This post changed in another window. Reload before saving.");
            return itemResponse(item);
        },
        async edit(owner: string, id: string, itemId: string, input: { prompt: string; baseVersionId: string }) {
            const { campaign, item } = await ownedItem(owner, id, itemId);
            if (["queued", "planning", "generating", "checking"].includes(campaign.status))
                throw new HttpError(409, "Wait for the campaign to finish before editing.");
            const base = await repo.version(input.baseVersionId);
            if (!base || base.itemId !== itemId || !base.assetId) throw new NotFoundError("Image version not found.");
            const versionId = randomUUID();
            const jobId = randomUUID();
            // Claim the image and append its version and job atomically. The displayed version stays unchanged while editing.
            await db.execute(sql`WITH claimed AS (
                UPDATE campaign_items SET status = 'generating', revision = revision + 1
                WHERE id = ${item.id} AND status IN ('ready','needs_attention','failed') RETURNING id
            ), version AS (
                INSERT INTO image_versions (id, item_id, parent_id, number, prompt)
                SELECT ${versionId}, id, ${base.id}, (SELECT COALESCE(MAX(number),0)+1 FROM image_versions WHERE item_id = ${item.id}), ${input.prompt} FROM claimed RETURNING id
            ) INSERT INTO jobs (id, brand_id, kind, entity_id) SELECT ${jobId}, ${campaign.brandId}, 'edit', id FROM version`);
            const job = await jobsRepo(db).get(jobId);
            if (!job) throw new HttpError(409, "An edit is already running for this image.");
            try {
                await tasks.dispatch(job);
            } catch (error) {
                await db
                    .update(imageVersions)
                    .set({ status: "failed", error: "The edit could not start. Please retry." })
                    .where(eq(imageVersions.id, versionId));
                await db.update(campaignItems).set({ status: item.status }).where(eq(campaignItems.id, itemId));
                throw error;
            }
            return job;
        },
        async restore(owner: string, id: string, itemId: string, versionId: string) {
            await ownedItem(owner, id, itemId);
            const version = await repo.version(versionId);
            if (!version || version.itemId !== itemId || !["ready", "needs_attention"].includes(version.status))
                throw new HttpError(400, "Choose a completed image version.");
            const row = (
                await db
                    .update(campaignItems)
                    .set({
                        currentVersionId: versionId,
                        status: version.status,
                        revision: sql`${campaignItems.revision} + 1`,
                    })
                    .where(
                        and(
                            eq(campaignItems.id, itemId),
                            sql`${campaignItems.status} NOT IN ('generating','checking','queued')`,
                        ),
                    )
                    .returning()
            )[0];
            if (!row) throw new HttpError(409, "Wait for the current edit to finish.");
            return itemResponse(row);
        },
        async download(owner: string, id: string, itemId: string) {
            const { item } = await ownedItem(owner, id, itemId);
            if (!item.currentVersionId) throw new HttpError(409, "This image is not ready yet.");
            const version = await repo.version(item.currentVersionId);
            const asset = version?.assetId
                ? (await db.select().from(assets).where(eq(assets.id, version.assetId)))[0]
                : null;
            if (!asset) throw new NotFoundError("Image file not found.");
            const filename = `${item.brief.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${item.brief.format}.png`;
            return { url: await services.storage.readUrl(asset.key, filename), filename };
        },
        async retry(owner: string, id: string) {
            const campaign = await owned(owner, id);
            if (!["failed", "needs_attention"].includes(campaign.status))
                throw new HttpError(409, "This campaign does not need a retry.");
            const job = await jobsRepo(db).latest(campaign.brandId, id);
            if (!job) throw new NotFoundError("Campaign job not found.");
            // Attention states keep completed images. Only failed images are regenerated by the worker.
            if (job.status === "failed") await tasks.retry(owner, job.id);
            else throw new HttpError(409, "Open the flagged image and describe the correction you want.");
            return response(
                (await repo.update(id, { status: "queued", stage: "Waiting to retry", error: null })) ?? campaign,
            );
        },
    };
}
