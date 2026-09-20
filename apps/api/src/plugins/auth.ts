import type { FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import type { Dependencies } from "../lib/dependencies";
import { HttpError } from "../lib/errors";

declare module "fastify" {
    interface FastifyRequest {
        ownerId: string;
    }
    interface FastifyInstance {
        requireAuth(request: FastifyRequest): Promise<void>;
        services: Dependencies;
    }
}
export const authPlugin = fp<{ services: Dependencies }>(async (app, { services }) => {
    app.decorate("services", services);
    app.decorateRequest("ownerId", "");
    app.decorate("requireAuth", async (request: FastifyRequest) => {
        const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
        if (!token) throw new HttpError(401, "Sign in to continue.");
        try {
            request.ownerId = await services.authenticate(token);
        } catch {
            throw new HttpError(401, "Your session has expired. Sign in again.");
        }
    });
});
