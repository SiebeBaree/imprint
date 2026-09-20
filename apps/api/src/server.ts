import "./instrument";
import { pathToFileURL } from "node:url";

import { createDb } from "@repo/db";
import { env } from "@repo/env/api";
import { createLogger } from "@repo/logger";

import { buildApp } from "./app";
import { createServices } from "./lib/services";

// Built once per process and reused, so serverless invocations after a cold start skip the setup.
let appPromise: ReturnType<typeof buildApp> | undefined;

export function getApp() {
    appPromise ??= buildApp({
        db: createDb(env.DATABASE_URL),
        services: createServices(),
        logger: createLogger({ pretty: process.env.NODE_ENV === "development" }),
        corsOrigin: env.CORS_ORIGIN,
        upstash:
            env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
                ? { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }
                : undefined,
    });
    return appPromise;
}

// Run as a plain node process (pnpm dev, pnpm start): bind a port. On Vercel this file is loaded
// lazily by the handler in app.ts and the guard is false, so no port is ever bound there.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const app = await getApp();
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
}
