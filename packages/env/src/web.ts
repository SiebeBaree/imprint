import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const isProd = import.meta.env.PROD;

/**
 * Web environment, inlined into the browser bundle at build time, so only VITE_* values belong here.
 *
 * VITE_API_URL is required in production builds: a bundle silently pointing at localhost is a broken deploy.
 * The observability keys are optional, each integration disables itself when its key is missing.
 */
export const env = createEnv({
    clientPrefix: "VITE_",
    client: {
        VITE_API_URL: isProd ? z.url() : z.url().default("http://localhost:3001"),
        VITE_POSTHOG_KEY: z.string().min(1).optional(),
        VITE_SENTRY_DSN: z.url().optional(),
    },
    runtimeEnv: import.meta.env,
    emptyStringAsUndefined: true,
    // For builds that have no environment, e.g. the bare CI build check: VITE_SKIP_ENV_VALIDATION=1 pnpm build
    skipValidation: Boolean(import.meta.env.VITE_SKIP_ENV_VALIDATION),
});
