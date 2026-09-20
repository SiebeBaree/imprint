import { verifyToken } from "@clerk/backend";
import { env } from "@repo/env/api";
import { runs, tasks } from "@trigger.dev/sdk";

import type { Dependencies } from "./dependencies";
import { createStorage } from "./storage";
export function configuredStorage() {
    return createStorage({
        accountId: env.R2_ACCOUNT_ID,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        bucket: env.R2_BUCKET,
    });
}
export function createServices(): Dependencies {
    return {
        storage: configuredStorage(),
        async authenticate(token) {
            const payload = await verifyToken(token, {
                secretKey: env.CLERK_SECRET_KEY,
                authorizedParties: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
            });
            return payload.sub;
        },
        async dispatch(job) {
            const run = await tasks.trigger(
                "imprint-job",
                { jobId: job.id },
                { idempotencyKey: `${job.id}:${job.attempts}`, idempotencyKeyTTL: "7d" },
            );
            return run.id;
        },
        async runFailure(runId) {
            const run = await runs.retrieve(runId, { retry: { maxAttempts: 1 } });
            if (run.status === "EXPIRED") return "The job expired before it could start. Please retry.";
            if (run.isCancelled) return "The job was interrupted. Please retry to continue.";
            if (run.isFailed) return "The job stopped before finishing. Please retry to continue.";
            return null;
        },
    };
}
