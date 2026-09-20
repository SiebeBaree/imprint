import type { BrandProfile } from "@repo/contracts";
import type { BrandRow, Database } from "@repo/db";
import { createLogger } from "@repo/logger";

import type { Dependencies } from "../../lib/dependencies";
import { jobsRepo } from "../jobs/jobs.repo";
import { jobsService } from "../jobs/jobs.service";
import { productsRepo } from "../products/products.repo";
const logger = createLogger();

import { HttpError } from "../../lib/errors";
import { brandsRepo } from "./brands.repo";

export function brandResponse(row: BrandRow) {
    return {
        ...row,
        createdAt: row.createdAt.toISOString(),
        profileConfirmedAt: row.profileConfirmedAt?.toISOString() ?? null,
    };
}
export function brandsService(db: Database, dependencies: Dependencies) {
    const repo = brandsRepo(db);
    const tasks = jobsService(db, dependencies);
    async function requireSources(brandId: string) {
        const brand = await repo.byId(brandId);
        if (!brand || !["ready", "partial"].includes(brand.instagramStatus))
            throw new HttpError(409, "Import an Instagram profile before continuing.");
        const files = await repo.readyAssets(brandId);
        if (!files.some((file) => file.role === "guidelines"))
            throw new HttpError(409, "Add a readable brand guidelines PDF.");
        if (!files.some((file) => file.role === "product"))
            throw new HttpError(409, "Add at least one product photo before continuing.");
        return files;
    }
    async function startRecommendations(ownerId: string) {
        const brand = await repo.forOwner(ownerId);
        if (brand.status !== "ready" || !brand.profileConfirmedAt)
            throw new HttpError(409, "Confirm your brand first.");
        if (brand.suggestionsStatus === "queued") return;
        if (!(await repo.claimRecommendations(brand.id))) return;
        try {
            await tasks.start(brand.id, "recommendations", brand.id);
        } catch (error) {
            await repo.update(brand.id, { suggestionsStatus: "failed" });
            logger.error({ err: error }, "recommendations.dispatch.failed");
        }
    }
    return {
        async get(owner: string) {
            const brand = await repo.forOwner(owner);
            await tasks.reconcile(brand.id);
            return brandResponse(await repo.forOwner(owner));
        },
        async update(owner: string, name: string) {
            const brand = await repo.forOwner(owner);
            return brandResponse((await repo.update(brand.id, { name })) ?? brand);
        },
        requireSources,
        async updateProfile(owner: string, version: number, profile: BrandProfile) {
            const brand = await repo.forOwner(owner);
            if (brand.status === "analyzing")
                throw new HttpError(409, "Wait for brand analysis to finish before editing.");
            const updated = await repo.updateProfile(brand.id, version, profile);
            if (!updated) throw new HttpError(409, "Your brand changed in another window. Reload before saving.");
            return brandResponse(updated);
        },
        async confirm(owner: string, version: number) {
            const brand = await repo.forOwner(owner);
            await requireSources(brand.id);
            if (!brand.profile || brand.profileVersion !== version)
                throw new HttpError(409, "Review the latest brand profile before continuing.");
            if (!(await productsRepo(db).references(brand.id)).some((file) => file.productId))
                throw new HttpError(409, "Add a product first.");
            const updated = await repo.confirm(brand.id, version, brand.profile);
            if (!updated) throw new HttpError(409, "Your brand changed. Reload and try again.");
            if (!updated.suggestions.length) await startRecommendations(owner);
            return brandResponse(await repo.forOwner(owner));
        },
        async recommend(owner: string) {
            await startRecommendations(owner);
            return brandResponse(await repo.forOwner(owner));
        },
        async importInstagram(owner: string, url: string) {
            const brand = await repo.forOwner(owner);
            if (brand.status === "analyzing") throw new HttpError(409, "Wait for brand analysis to finish.");
            const active = await jobsRepo(db).active(brand.id);
            if (active?.kind === "instagram") return active;
            if (!(await repo.claimInstagram(brand.id, url)))
                throw new HttpError(409, "An Instagram import is already running.");
            try {
                return await tasks.start(brand.id, "instagram", brand.id);
            } catch (error) {
                await repo.update(brand.id, {
                    instagramStatus: "failed",
                    instagramMessage: "The import could not start. Try again.",
                });
                throw error;
            }
        },
        async analyze(owner: string) {
            const brand = await repo.forOwner(owner);
            if (brand.status === "analyzing") {
                const active = await jobsRepo(db).latest(brand.id, brand.id);
                if (active) return active;
            }
            await requireSources(brand.id);
            if (!(await repo.claimAnalysis(brand.id))) throw new HttpError(409, "Brand analysis is already running.");
            try {
                return await tasks.start(brand.id, "analysis", brand.id);
            } catch (error) {
                await repo.update(brand.id, { status: "failed", error: "Analysis could not start. Please retry." });
                throw error;
            }
        },
    };
}
