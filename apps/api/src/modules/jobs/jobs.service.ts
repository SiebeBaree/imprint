import { jobs, type Database, type JobRow } from "@repo/db";
import { createLogger } from "@repo/logger";
import { and, eq, sql } from "drizzle-orm";

import type { Dependencies } from "../../lib/dependencies";
import { failJob } from "../../jobs/fail-job";
import { HttpError, NotFoundError } from "../../lib/errors";
import { brandsRepo } from "../brands/brands.repo";
import { jobsRepo } from "./jobs.repo";
const logger = createLogger();
export function jobsService(db: Database, services: Dependencies) {
    const repo = jobsRepo(db);
    // Expired queued runs never start a worker, so its failure hook cannot update our database.
    async function reconcile(brandId: string) {
        await Promise.all(
            (await repo.stale(brandId)).map(async (job) => {
                if (!job.runId) return;
                await repo.update(job.id, {});
                try {
                    const failure = await services.runFailure(job.runId);
                    if (failure) await failJob(db, job.id, failure, job.runId);
                } catch (error) {
                    logger.warn({ err: error, jobId: job.id, runId: job.runId }, "job.status.unavailable");
                }
            }),
        );
    }
    async function dispatch(job: JobRow) {
        try {
            const runId = await services.dispatch(job);
            await repo.update(job.id, { runId });
            return job;
        } catch (error) {
            await repo.update(job.id, { status: "failed", error: "The job could not start. Please retry." });
            throw error;
        }
    }
    return {
        async start(brandId: string, kind: JobRow["kind"], entityId: string) {
            return dispatch(await repo.create(brandId, kind, entityId));
        },
        dispatch,
        reconcile,
        async get(owner: string, id: string) {
            const brand = await brandsRepo(db).forOwner(owner);
            const job = await repo.get(id);
            if (!job || job.brandId !== brand.id) throw new NotFoundError("Job not found.");
            await reconcile(brand.id);
            return (await repo.get(id)) ?? job;
        },
        async retry(owner: string, id: string) {
            const brand = await brandsRepo(db).forOwner(owner);
            const previous = await repo.get(id);
            if (!previous || previous.brandId !== brand.id) throw new NotFoundError("Job not found.");
            const job = (
                await db
                    .update(jobs)
                    .set({ status: "queued", error: null, attempts: sql`${jobs.attempts} + 1` })
                    .where(and(eq(jobs.id, id), eq(jobs.status, "failed")))
                    .returning()
            )[0];
            if (!job) throw new HttpError(409, "This job is already running or complete.");
            return dispatch(job);
        },
    };
}
