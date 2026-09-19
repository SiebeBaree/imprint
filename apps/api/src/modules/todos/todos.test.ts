import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildTestApp } from "../../test/build-app";

let harness: Awaited<ReturnType<typeof buildTestApp>>;

beforeAll(async () => {
    harness = await buildTestApp();
});
afterAll(() => harness.close());
beforeEach(() => harness.reset());

async function createTodo(title: string) {
    const response = await harness.app.inject({ method: "POST", url: "/todos", body: { title } });
    expect(response.statusCode).toBe(201);
    return response.json();
}

describe("GET /todos", () => {
    it("returns an empty list on a fresh database", async () => {
        const response = await harness.app.inject({ method: "GET", url: "/todos" });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([]);
    });

    it("returns created todos, newest first", async () => {
        await createTodo("first");
        await createTodo("second");
        const response = await harness.app.inject({ method: "GET", url: "/todos" });
        expect(response.json().map((todo: { title: string }) => todo.title)).toEqual(["second", "first"]);
    });
});

describe("POST /todos", () => {
    it("creates a todo and returns the wire format", async () => {
        const todo = await createTodo("  buy milk  ");
        expect(todo).toMatchObject({ title: "buy milk", completed: false });
        expect(todo.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(new Date(todo.createdAt).getTime()).not.toBeNaN();
    });

    it("rejects an empty title with field-level issues", async () => {
        const response = await harness.app.inject({ method: "POST", url: "/todos", body: { title: "   " } });
        expect(response.statusCode).toBe(400);
        const body = response.json();
        expect(body.message).toBe("Invalid input.");
        expect(body.issues).toEqual([{ path: "title", message: "Add a title first." }]);
        expect(body.requestId).toBeTruthy();
    });
});

describe("PATCH /todos/:id", () => {
    it("toggles completion", async () => {
        const todo = await createTodo("toggle me");
        const response = await harness.app.inject({
            method: "PATCH",
            url: `/todos/${todo.id}`,
            body: { completed: true },
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ id: todo.id, completed: true });
    });

    it("returns 404 for a todo that does not exist", async () => {
        const response = await harness.app.inject({
            method: "PATCH",
            url: "/todos/8f14e45f-ceea-4b67-8a55-6a86e93ac3e1",
            body: { completed: true },
        });
        expect(response.statusCode).toBe(404);
        expect(response.json().requestId).toBeTruthy();
    });

    it("rejects a non-uuid id before touching the database", async () => {
        const response = await harness.app.inject({ method: "PATCH", url: "/todos/nope", body: { completed: true } });
        expect(response.statusCode).toBe(400);
    });
});

describe("DELETE /todos/:id", () => {
    it("deletes and is idempotent", async () => {
        const todo = await createTodo("delete me");
        const first = await harness.app.inject({ method: "DELETE", url: `/todos/${todo.id}` });
        expect(first.statusCode).toBe(204);
        const second = await harness.app.inject({ method: "DELETE", url: `/todos/${todo.id}` });
        expect(second.statusCode).toBe(204);

        const list = await harness.app.inject({ method: "GET", url: "/todos" });
        expect(list.json()).toEqual([]);
    });
});

describe("request id", () => {
    it("echoes a caller-provided x-request-id on the response", async () => {
        const response = await harness.app.inject({
            method: "GET",
            url: "/todos",
            headers: { "x-request-id": "web-abc123" },
        });
        expect(response.headers["x-request-id"]).toBe("web-abc123");
    });
});
