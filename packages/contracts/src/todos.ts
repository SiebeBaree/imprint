import { z } from "zod";

// Wire format: dates travel as ISO strings, the api serializes and the web parses against the same schema.
export const todoSchema = z.object({
    id: z.uuid(),
    title: z.string(),
    completed: z.boolean(),
    createdAt: z.iso.datetime(),
});

export const todoListSchema = z.array(todoSchema);

export const todoIdParamSchema = z.object({
    id: z.uuid(),
});

export const createTodoSchema = z.object({
    title: z.string().trim().min(1, "Add a title first.").max(200, "Keep titles under 200 characters."),
});

export const updateTodoSchema = z.object({
    completed: z.boolean(),
});

export type Todo = z.infer<typeof todoSchema>;
export type CreateTodoInput = z.input<typeof createTodoSchema>;
export type UpdateTodoInput = z.input<typeof updateTodoSchema>;
