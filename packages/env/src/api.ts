import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

// CORS_ORIGIN is a comma-separated allowlist, so plain z.url() would reject a second entry. Entries are trimmed
// where they are consumed (the security plugin), the schema only guarantees every entry is a real url.
const originList = z
    .string()
    .refine(
        (value) => value.split(",").every((origin) => z.url().safeParse(origin.trim()).success),
        "Expected a comma-separated list of origins",
    );

export const env = createEnv({
    server: {
        DATABASE_URL: z.url(),
        CLERK_SECRET_KEY: z.string().min(1),
        R2_ACCOUNT_ID: z.string().min(1),
        R2_ACCESS_KEY_ID: z.string().min(1),
        R2_SECRET_ACCESS_KEY: z.string().min(1),
        R2_BUCKET: z.string().min(1),
        TRIGGER_SECRET_KEY: z.string().min(1),
        TRIGGER_PROJECT_REF: z.string().min(1),
        OPENROUTER_API_KEY: z.string().min(1),
        OPENAI_API_KEY: z.string().min(1),
        GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
        APIFY_TOKEN: z.string().min(1),
        INSTAGRAM_POST_LIMIT: z.coerce.number().int().min(1).max(5000).default(1000),
        PORT: z.coerce.number().int().positive().default(3001),
        CORS_ORIGIN: isProd ? originList : originList.default("http://localhost:5173"),
        UPSTASH_REDIS_REST_URL: isProd ? z.url() : z.url().optional(),
        UPSTASH_REDIS_REST_TOKEN: isProd ? z.string().min(1) : z.string().min(1).optional(),
        SENTRY_DSN: z.url().optional(),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
    // For processes that have no environment, e.g. CI builds: SKIP_ENV_VALIDATION=1 pnpm build
    skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
});
