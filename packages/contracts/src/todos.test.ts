import { describe, expect, it } from "vitest";

import { createTodoSchema, todoIdParamSchema } from "./todos";

describe("createTodoSchema", () => {
    it("trims surrounding whitespace", () => {
        expect(createTodoSchema.parse({ title: "  buy milk  " })).toEqual({ title: "buy milk" });
    });

    it("rejects titles that are empty after trimming", () => {
        expect(createTodoSchema.safeParse({ title: "   " }).success).toBe(false);
    });

    it("rejects titles over 200 characters", () => {
        expect(createTodoSchema.safeParse({ title: "x".repeat(201) }).success).toBe(false);
    });
});

describe("todoIdParamSchema", () => {
    it("rejects non-uuid ids", () => {
        expect(todoIdParamSchema.safeParse({ id: "1; DROP TABLE todos" }).success).toBe(false);
    });
});
