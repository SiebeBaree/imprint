import { env } from "@repo/env/web";
import * as Sentry from "@sentry/react";
import posthog from "posthog-js";

// Imported for its side effects as the first thing in root.tsx, so both SDKs are live before the app renders.

// Sentry: errors only and lean. Axiom owns logs (api side) and PostHog owns product analytics. Envelopes go through
// the api's /tunnel route so ad blockers only see first-party requests.
Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    enabled: Boolean(env.VITE_SENTRY_DSN),
    // On Vercel this distinguishes preview deploys from production; MODE would call both "production".
    environment: import.meta.env.VITE_VERCEL_ENV ?? import.meta.env.MODE,
    tunnel: `${env.VITE_API_URL}/tunnel`,
    tracesSampleRate: 0.1,
    maxBreadcrumbs: 30,
    sendDefaultPii: false,
    ignoreErrors: [
        // Browser quirks that fire without any actual breakage.
        "ResizeObserver loop limit exceeded",
        "ResizeObserver loop completed with undelivered notifications",
        // The user navigated away or lost connectivity mid-request.
        "Failed to fetch",
        "NetworkError when attempting to fetch a resource",
        "Load failed",
    ],
    denyUrls: [/^chrome-extension:\/\//i, /^moz-extension:\/\//i, /^safari-extension:\/\//i],
});

// The window guard matters at build time: the SPA fallback prerender runs this module in Node, where posthog-js
// resolves to a server stub without init.
if (env.VITE_POSTHOG_KEY && typeof window !== "undefined") {
    posthog.init(env.VITE_POSTHOG_KEY, {
        api_host: "/api/pipe",
        ui_host: "https://eu.posthog.com",
        defaults: "2026-05-30",
        capture_exceptions: false,
    });
}
