import { brands, campaigns, campaignItems, imageVersions, type Database } from "@repo/db";
import { and, eq, inArray } from "drizzle-orm";

import { campaignsRepo } from "../modules/campaigns/campaigns.repo";
import { jobsRepo } from "../modules/jobs/jobs.repo";

// Called by the worker and Trigger lifecycle hooks, including cancellation and timeouts.
export async function failJob(db: Database, jobId: string, message: string, runId?: string) {
    const jobRepo = jobsRepo(db);
    const job = await jobRepo.get(jobId);
    if (!job || job.status === "complete" || (runId && job.runId && job.runId !== runId)) return;
    await jobRepo.update(jobId, { status: "failed", error: message });
    if (job.kind === "instagram")
        await db
            .update(brands)
            .set({
                instagramStatus: "failed",
                instagramRunId: null,
                instagramMessage: "Instagram could not be imported. Check that the profile is public and try again.",
            })
            .where(eq(brands.id, job.brandId));
    if (job.kind === "recommendations")
        await db.update(brands).set({ suggestionsStatus: "failed" }).where(eq(brands.id, job.brandId));
    if (job.kind === "analysis")
        await db.update(brands).set({ status: "failed", error: message }).where(eq(brands.id, job.brandId));
    if (job.kind === "campaign") {
        const items = await campaignsRepo(db).items(job.entityId);
        const unfinished = items
            .filter((item) => ["queued", "generating", "checking"].includes(item.status))
            .map((item) => item.id);
        if (unfinished.length) {
            await db
                .update(imageVersions)
                .set({ status: "failed", error: message })
                .where(
                    and(
                        inArray(imageVersions.itemId, unfinished),
                        inArray(imageVersions.status, ["queued", "generating", "checking"]),
                    ),
                );
            await db.update(campaignItems).set({ status: "failed" }).where(inArray(campaignItems.id, unfinished));
        }
        await db
            .update(campaigns)
            .set({ status: "failed", error: message, stage: "Campaign paused" })
            .where(eq(campaigns.id, job.entityId));
    }
    if (job.kind === "edit") {
        const version = await campaignsRepo(db).version(job.entityId);
        if (version) {
            await db
                .update(imageVersions)
                .set({ status: "failed", error: message })
                .where(eq(imageVersions.id, version.id));
            await db.update(campaignItems).set({ status: "failed" }).where(eq(campaignItems.id, version.itemId));
        }
    }
}
