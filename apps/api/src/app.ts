import type { IncomingMessage, ServerResponse } from "node:http";

import type { Database } from "@repo/db";
import type { Logger } from "@repo/logger";
import * as Sentry from "@sentry/node";
import fastify, { LogController } from "fastify";
import {
    hasZodFastifySchemaValidationErrors,
    serializerCompiler,
    validatorCompiler,
    type ZodTypeProvider,
} from "fastify-type-provider-zod";

import type { Dependencies } from "./lib/dependencies";
import { HttpError } from "./lib/errors";
import { assetsRoutes } from "./modules/assets/assets.routes";
import { brandsRoutes } from "./modules/brands/brands.routes";
import { campaignsRoutes } from "./modules/campaigns/campaigns.routes";
import { healthModule } from "./modules/health";
import { jobsRoutes } from "./modules/jobs/jobs.routes";
import { productsRoutes } from "./modules/products/products.routes";
import { tunnelModule } from "./modules/tunnel";
import { authPlugin } from "./plugins/auth";
import { observabilityPlugin } from "./plugins/observability";
import { rateLimitPlugin } from "./plugins/rate-limit";
import { genReqId, requestIdPlugin } from "./plugins/request-id";
import { securityPlugin } from "./plugins/security";

declare module "fastify" {
    interface FastifyInstance {
        db: Database;
    }
}

export type AppOptions = {
    db: Database;
    services: Dependencies;
    logger?: Logger;
    corsOrigin: string;
    upstash?: { url: string; token: string };
};

export async function buildApp({ db, services, logger, corsOrigin, upstash }: AppOptions) {
    const app = fastify({
        ...(logger ? { loggerInstance: logger } : { logger: false }),
        // The observability plugin logs one canonical line per request instead.
        logController: new LogController({ disableRequestLogging: true }),
        trustProxy: true,
        genReqId,
    }).withTypeProvider<ZodTypeProvider>();

    // Zod validates every declared input and serializes (and so validates) every declared output.
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    app.decorate("db", db);

    await app.register(securityPlugin, { corsOrigin });
    await app.register(rateLimitPlugin, { upstash });
    await app.register(requestIdPlugin);
    await app.register(observabilityPlugin);

    // Must be set before the route modules register: encapsulated scopes resolve their error handler at registration.
    app.setErrorHandler((error, request, reply) => {
        const requestId = request.id;

        if (hasZodFastifySchemaValidationErrors(error)) {
            return reply.status(400).send({
                message: "Invalid input.",
                requestId,
                issues: error.validation.map((issue) => ({
                    path: issue.instancePath.split("/").filter(Boolean).join("."),
                    message: issue.message ?? "Invalid value",
                })),
            });
        }

        if (error instanceof HttpError) {
            return reply.status(error.status).send({ message: error.message, requestId });
        }

        Sentry.captureException(error, { tags: { requestId } });
        request.log.error({ requestId, err: error }, "request.failed");
        return reply.status(500).send({ message: "Something went wrong. Please try again.", requestId });
    });

    await app.register(healthModule);
    await app.register(authPlugin, { services });
    await app.register(brandsRoutes);
    await app.register(assetsRoutes);
    await app.register(productsRoutes);
    await app.register(campaignsRoutes);
    await app.register(jobsRoutes);
    await app.register(tunnelModule);

    return app;
}

// Vercel's Fastify builder deploys this file as the function entrypoint and calls the default export
// per request. The dynamic import keeps server-only side effects (Sentry, env validation, the real db)
// out of tests, which import buildApp from here.
export default async function handler(req: IncomingMessage, res: ServerResponse) {
    const { getApp } = await import("./server");
    const app = await getApp();
    await app.ready();
    app.server.emit("request", req, res);
}
