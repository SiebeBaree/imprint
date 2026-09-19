import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const captureException = vi.fn<(...args: unknown[]) => void>();
vi.mock("@sentry/react", () => ({ captureException: (...args: unknown[]) => captureException(...args) }));

const { ApiError, apiFetch } = await import("./index");

function stubFetch(status: number, body: unknown) {
    const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

afterEach(() => {
    vi.unstubAllGlobals();
    captureException.mockClear();
});

describe("apiFetch", () => {
    it("parses a successful response against the schema", async () => {
        stubFetch(200, { status: "ok" });
        await expect(apiFetch("/health", z.object({ status: z.literal("ok") }))).resolves.toEqual({ status: "ok" });
    });

    it("sends a generated x-request-id", async () => {
        const fetchMock = stubFetch(200, []);
        await apiFetch("/todos", z.array(z.unknown()));
        const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
        expect(headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("throws ApiError with the server's message, requestId and issues", async () => {
        stubFetch(400, {
            message: "Invalid input.",
            requestId: "req-1",
            issues: [{ path: "title", message: "Add a title first." }],
        });
        const error = await apiFetch("/todos", z.unknown(), { method: "POST" }).catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({ status: 400, message: "Invalid input.", requestId: "req-1" });
    });

    it("throws a generic ApiError when the error body is not the contract shape", async () => {
        stubFetch(502, undefined);
        await expect(apiFetch("/todos", z.unknown())).rejects.toMatchObject({ message: "Request failed (502)" });
    });

    it("reports a contract-violating 200 to Sentry and rejects", async () => {
        stubFetch(200, { unexpected: true });
        await expect(apiFetch("/health", z.object({ status: z.literal("ok") }))).rejects.toBeInstanceOf(z.ZodError);
        expect(captureException).toHaveBeenCalledWith(expect.any(z.ZodError), {
            tags: { path: "/health", requestId: expect.stringMatching(/^[0-9a-f-]{36}$/) },
        });
    });

    it("does not report handled error responses to Sentry", async () => {
        stubFetch(400, { message: "Invalid input.", requestId: "req-1" });
        await expect(apiFetch("/todos", z.unknown(), { method: "POST" })).rejects.toBeInstanceOf(ApiError);
        expect(captureException).not.toHaveBeenCalled();
    });
});
