import {
    brandSchema,
    confirmProfileSchema,
    importInstagramSchema,
    jobSchema,
    updateBrandSchema,
    updateProfileSchema,
} from "@repo/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import { brandsService } from "./brands.service";
export const brandsRoutes: FastifyPluginAsyncZod = async (app) => {
    app.addHook("onRequest", app.requireAuth);
    const service = brandsService(app.db, app.services);
    app.get("/brand", { schema: { response: { 200: brandSchema } } }, (request) => service.get(request.ownerId));
    app.patch("/brand", { schema: { body: updateBrandSchema, response: { 200: brandSchema } } }, (request) =>
        service.update(request.ownerId, request.body.name),
    );
    app.patch("/brand/profile", { schema: { body: updateProfileSchema, response: { 200: brandSchema } } }, (request) =>
        service.updateProfile(request.ownerId, request.body.version, request.body.profile),
    );
    app.post("/brand/confirm", { schema: { body: confirmProfileSchema, response: { 200: brandSchema } } }, (request) =>
        service.confirm(request.ownerId, request.body.version),
    );
    app.post("/brand/recommendations", { schema: { response: { 200: brandSchema } } }, (request) =>
        service.recommend(request.ownerId),
    );
    app.post(
        "/brand/instagram",
        { schema: { body: importInstagramSchema, response: { 202: jobSchema } } },
        async (request, reply) =>
            reply.code(202).send(await service.importInstagram(request.ownerId, request.body.url)),
    );
    app.post("/brand/analyze", { schema: { response: { 202: jobSchema } } }, async (request, reply) =>
        reply.code(202).send(await service.analyze(request.ownerId)),
    );
};
