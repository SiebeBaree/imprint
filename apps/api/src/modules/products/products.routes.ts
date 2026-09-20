import { idParamsSchema, productInputSchema, productListSchema, productSchema } from "@repo/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import { productsService } from "./products.service";

export const productsRoutes: FastifyPluginAsyncZod = async (app) => {
    app.addHook("onRequest", app.requireAuth);
    const service = productsService(app.db);
    app.get("/products", { schema: { response: { 200: productListSchema } } }, (request) =>
        service.list(request.ownerId),
    );
    app.post(
        "/products",
        { schema: { body: productInputSchema, response: { 201: productSchema } } },
        async (request, reply) => reply.code(201).send(await service.save(request.ownerId, request.body)),
    );
    app.patch(
        "/products/:id",
        { schema: { params: idParamsSchema, body: productInputSchema, response: { 200: productSchema } } },
        (request) => service.save(request.ownerId, request.body, request.params.id),
    );
};
