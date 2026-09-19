import {
    createTodoSchema,
    errorSchema,
    todoIdParamSchema,
    todoListSchema,
    todoSchema,
    updateTodoSchema,
} from "@repo/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

import { todosService } from "./todos.service";

export const todosRoutes: FastifyPluginAsyncZod = async (app) => {
    const service = todosService(app.db);

    app.get("/todos", { schema: { response: { 200: todoListSchema } } }, () => service.list());

    app.post(
        "/todos",
        { schema: { body: createTodoSchema, response: { 201: todoSchema, 400: errorSchema } } },
        async (request, reply) => reply.status(201).send(await service.create(request.body.title)),
    );

    app.patch(
        "/todos/:id",
        {
            schema: {
                params: todoIdParamSchema,
                body: updateTodoSchema,
                response: { 200: todoSchema, 400: errorSchema, 404: errorSchema },
            },
        },
        (request) => service.setCompleted(request.params.id, request.body.completed),
    );

    app.delete(
        "/todos/:id",
        { schema: { params: todoIdParamSchema, response: { 204: z.null(), 400: errorSchema } } },
        async (request, reply) => {
            await service.remove(request.params.id);
            return reply.status(204).send(null);
        },
    );
};
