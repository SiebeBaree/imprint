import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import fp from "fastify-plugin";

export const securityPlugin = fp<{ corsOrigin: string }>(async (app, { corsOrigin }) => {
    await app.register(helmet, {
        // A JSON api serves no documents, so the CSP allows nothing at all.
        contentSecurityPolicy: {
            useDefaults: false,
            directives: { "default-src": ["'none'"], "frame-ancestors": ["'none'"] },
        },
    });
    await app.register(cors, {
        // Comma-separated allowlist so previews can be added next to the production origin.
        origin: corsOrigin.split(",").map((origin) => origin.trim()),
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        // Lets the browser read the correlation id from cross-origin responses.
        exposedHeaders: ["x-request-id"],
    });
});
