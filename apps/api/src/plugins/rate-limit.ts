import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import fp from "fastify-plugin";

/**
 * One shared policy for every route: 20 requests per 10 seconds per IP per route. Add a separate Ratelimit instance
 * here if an endpoint ever needs its own budget (e.g. auth attempts).
 *
 * Without Upstash credentials (local dev) rate limiting is a no-op; the env schema makes them required in production.
 */
export const rateLimitPlugin = fp<{ upstash?: { url: string; token: string } }>(async (app, { upstash }) => {
    const limiter = upstash
        ? new Ratelimit({ redis: new Redis(upstash), limiter: Ratelimit.slidingWindow(20, "10 s"), prefix: "rl" })
        : undefined;

    app.addHook("onRequest", async (request, reply) => {
        if (!limiter || request.routeOptions.url === "/health") return;
        const result = await limiter.limit(`${request.routeOptions.url ?? "unmatched"}:${request.ip}`);
        if (!result.success) {
            const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
            return reply
                .status(429)
                .send({ message: `Too many requests. Try again in ${retryAfterSeconds}s.`, requestId: request.id });
        }
    });
});
