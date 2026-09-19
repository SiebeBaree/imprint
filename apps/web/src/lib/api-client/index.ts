import { errorSchema, type ApiErrorBody } from "@repo/contracts";
import { env } from "@repo/env/web";
import * as Sentry from "@sentry/react";
import type { z } from "zod";

export class ApiError extends Error {
    readonly status: number;
    /** Sent with the request, echoed by the api, searchable in Axiom and Sentry. Quote it to support. */
    readonly requestId?: string;
    readonly issues?: ApiErrorBody["issues"];

    constructor(status: number, body: ApiErrorBody) {
        super(body.message);
        this.name = "ApiError";
        this.status = status;
        this.requestId = body.requestId;
        this.issues = body.issues;
    }
}

/**
 * The only way this app talks to the api. Every response is parsed against its contract schema, so a drifting api
 * fails loudly here instead of corrupting state downstream. Every request carries a generated x-request-id that the
 * api adopts, tying the browser call to the api log line and Sentry event.
 */
export async function apiFetch<Schema extends z.ZodType>(
    path: string,
    schema: Schema,
    init?: RequestInit,
): Promise<z.output<Schema>> {
    const requestId = crypto.randomUUID();
    const response = await fetch(`${env.VITE_API_URL}${path}`, {
        ...init,
        headers: {
            // Only sent with a body: fastify rejects bodyless requests (DELETE) that claim a json content type.
            ...(init?.body != null && { "content-type": "application/json" }),
            "x-request-id": requestId,
            ...init?.headers,
        },
    });

    if (!response.ok) {
        const parsed = errorSchema.safeParse(await response.json().catch(() => null));
        throw new ApiError(
            response.status,
            parsed.success ? parsed.data : { message: `Request failed (${response.status})`, requestId },
        );
    }

    if (response.status === 204) return undefined as z.output<Schema>;

    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
        // A 200 that violates the contract means web and api run mismatched builds (deploy skew). The api considers
        // this request a success, so this is the only place that can report it. TanStack Query handles the rethrow,
        // which is why the browser SDK would never capture it on its own.
        Sentry.captureException(parsed.error, { tags: { path, requestId } });
        throw parsed.error;
    }
    return parsed.data;
}
