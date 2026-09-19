import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

const envelopeHeaderSchema = z.object({ dsn: z.url() });

/**
 * Forwards Sentry envelopes from the web app to Sentry's ingest servers, so ad blockers only ever see a first-party
 * request. See the `tunnel` option in the web Sentry init.
 */
export const tunnelModule: FastifyPluginAsyncZod = async (app) => {
    // The browser SDK posts envelopes as text/plain, which fastify has no parser for by default.
    app.addContentTypeParser(
        ["text/plain", "application/x-sentry-envelope"],
        { parseAs: "string" },
        (_req, body, done) => done(null, body),
    );

    app.post("/tunnel", { schema: { body: z.string().min(1).max(200_000) } }, async (request, reply) => {
        const newline = request.body.indexOf("\n");
        const headerLine = newline === -1 ? request.body : request.body.slice(0, newline);

        let dsn: URL;
        try {
            dsn = new URL(envelopeHeaderSchema.parse(JSON.parse(headerLine)).dsn);
        } catch {
            return reply.status(400).send({ message: "Invalid envelope.", requestId: request.id });
        }
        // Only forward to Sentry's own ingest hosts; anything else would make this an open proxy.
        if (!dsn.hostname.endsWith(".sentry.io")) {
            return reply.status(400).send({ message: "Invalid envelope.", requestId: request.id });
        }

        const projectId = dsn.pathname.replaceAll("/", "");
        const upstream = await fetch(`https://${dsn.hostname}/api/${projectId}/envelope/`, {
            method: "POST",
            body: request.body,
            headers: { "content-type": "application/x-sentry-envelope" },
        });
        return reply.status(upstream.status).send();
    });
};
