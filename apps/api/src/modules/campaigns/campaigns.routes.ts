import {
    campaignSchema,
    campaignListSchema,
    createCampaignSchema,
    idempotencyHeadersSchema,
    idParamsSchema,
    campaignItemParamsSchema,
    updateItemSchema,
    campaignItemSchema,
    editImageSchema,
    restoreImageSchema,
    downloadSchema,
    jobSchema,
} from "@repo/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import { campaignsService } from "./campaigns.service";
export const campaignsRoutes: FastifyPluginAsyncZod = async (app) => {
    app.addHook("onRequest", app.requireAuth);
    const service = campaignsService(app.db, app.services);
    app.get("/campaigns", { schema: { response: { 200: campaignListSchema } } }, (request) =>
        service.list(request.ownerId),
    );
    app.post(
        "/campaigns",
        {
            schema: {
                body: createCampaignSchema,
                headers: idempotencyHeadersSchema,
                response: { 202: campaignSchema },
            },
        },
        async (request, reply) =>
            reply
                .code(202)
                .send(await service.create(request.ownerId, request.headers["idempotency-key"], request.body)),
    );
    app.get("/campaigns/:id", { schema: { params: idParamsSchema, response: { 200: campaignSchema } } }, (request) =>
        service.get(request.ownerId, request.params.id),
    );
    app.post(
        "/campaigns/:id/retry",
        { schema: { params: idParamsSchema, response: { 200: campaignSchema } } },
        (request) => service.retry(request.ownerId, request.params.id),
    );
    app.patch(
        "/campaigns/:id/items/:itemId",
        { schema: { params: campaignItemParamsSchema, body: updateItemSchema, response: { 200: campaignItemSchema } } },
        (request) => service.updateItem(request.ownerId, request.params.id, request.params.itemId, request.body),
    );
    app.post(
        "/campaigns/:id/items/:itemId/edit",
        { schema: { params: campaignItemParamsSchema, body: editImageSchema, response: { 202: jobSchema } } },
        async (request, reply) =>
            reply
                .code(202)
                .send(await service.edit(request.ownerId, request.params.id, request.params.itemId, request.body)),
    );
    app.post(
        "/campaigns/:id/items/:itemId/restore",
        {
            schema: {
                params: campaignItemParamsSchema,
                body: restoreImageSchema,
                response: { 200: campaignItemSchema },
            },
        },
        (request) => service.restore(request.ownerId, request.params.id, request.params.itemId, request.body.versionId),
    );
    app.get(
        "/campaigns/:id/items/:itemId/download",
        { schema: { params: campaignItemParamsSchema, response: { 200: downloadSchema } } },
        (request) => service.download(request.ownerId, request.params.id, request.params.itemId),
    );
};
