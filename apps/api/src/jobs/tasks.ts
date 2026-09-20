import "../instrument";
import { createDb } from "@repo/db";
import { env } from "@repo/env/api";
import * as Sentry from "@sentry/node";
import { task, wait } from "@trigger.dev/sdk";

import { createAi } from "../lib/providers/ai";
import { createInstagramService } from "../lib/providers/instagram";
import { configuredStorage } from "../lib/services";
import { failJob } from "./fail-job";
import { runJob } from "./runner";
export const imprintJob = task({
    id: "imprint-job",
    maxDuration: 7200,
    retry: { maxAttempts: 1 },
    queue: { concurrencyLimit: 3 },
    onFailure: async ({ payload, error, ctx }) => {
        Sentry.captureException(error, { tags: { jobId: payload.jobId, runId: ctx.run.id } });
        await failJob(
            createDb(env.DATABASE_URL),
            payload.jobId,
            "The job stopped before finishing. Please retry to continue.",
            ctx.run.id,
        );
        await Sentry.flush(2000);
    },
    onCancel: async ({ payload, ctx }) => {
        await failJob(
            createDb(env.DATABASE_URL),
            payload.jobId,
            "The job was interrupted. Please retry to continue.",
            ctx.run.id,
        );
    },
    run: async ({ jobId }: { jobId: string }) => {
        const db = createDb(env.DATABASE_URL);
        const storage = configuredStorage();
        await runJob(
            db,
            {
                storage,
                ai: createAi(
                    {
                        openrouterKey: env.OPENROUTER_API_KEY,
                        openaiKey: env.OPENAI_API_KEY,
                        googleKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
                    },
                    db,
                    storage,
                ),
                instagram: createInstagramService(env.APIFY_TOKEN, env.INSTAGRAM_POST_LIMIT),
                pause: async (seconds) => {
                    await wait.for({ seconds });
                },
            },
            jobId,
        );
    },
});
