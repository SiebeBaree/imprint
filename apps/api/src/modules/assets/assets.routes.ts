import {
    assetListSchema,
    assetSchema,
    idParamsSchema,
    updateAssetSchema,
    uploadSchema,
    uploadTicketSchema,
} from "@repo/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import { assetsService } from "./assets.service";
export const assetsRoutes: FastifyPluginAsyncZod = async (app) => {
    app.addHook("onRequest", app.requireAuth);
    const service = assetsService(app.db, app.services.storage);
    app.get("/assets", { schema: { response: { 200: assetListSchema } } }, (request) => service.list(request.ownerId));
    app.post(
        "/assets/upload",
        { schema: { body: uploadSchema, response: { 201: uploadTicketSchema } } },
        async (request, reply) => reply.code(201).send(await service.upload(request.ownerId, request.body)),
    );
    app.post(
        "/assets/:id/complete",
        { schema: { params: idParamsSchema, response: { 200: assetSchema } } },
        (request) => service.complete(request.ownerId, request.params.id),
    );
    app.patch(
        "/assets/:id",
        { schema: { params: idParamsSchema, body: updateAssetSchema, response: { 200: assetSchema } } },
        (request) => service.update(request.ownerId, request.params.id, request.body),
    );
    app.delete("/assets/:id", { schema: { params: idParamsSchema } }, async (request, reply) => {
        await service.remove(request.ownerId, request.params.id);
        return reply.code(204).send();
    });
};
