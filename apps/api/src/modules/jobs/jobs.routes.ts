import { idParamsSchema, jobSchema } from "@repo/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import { jobsService } from "./jobs.service";
export const jobsRoutes: FastifyPluginAsyncZod = async (app) => {
    app.addHook("onRequest", app.requireAuth);
    const service = jobsService(app.db, app.services);
    app.get("/jobs/:id", { schema: { params: idParamsSchema, response: { 200: jobSchema } } }, (request) =>
        service.get(request.ownerId, request.params.id),
    );
    app.post("/jobs/:id/retry", { schema: { params: idParamsSchema, response: { 200: jobSchema } } }, (request) =>
        service.retry(request.ownerId, request.params.id),
    );
};
