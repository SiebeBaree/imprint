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

/**
 * Api environment.
 *
 * Three tiers:
 * - DATABASE_URL: always required, the api cannot function without it.
 * - CORS_ORIGIN and Upstash: required in production, optional in dev where localhost and the no-op limiter are fine.
 *   CORS decides who may call the api and rate limiting is a security control, so a forgotten variable must fail the
 *   deploy instead of shipping an open api.
 * - SENTRY_DSN: always optional, without it errors only land in the logs.
 *
 * Axiom needs no variable here: logs go to stdout as JSON and Vercel's Axiom log drain ships them.
 */
export const env = createEnv({
    server: {
        DATABASE_URL: z.url(),
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
