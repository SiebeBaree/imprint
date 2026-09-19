import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [reactRouter(), tailwindcss()],
    // Vercel exposes VERCEL_ENV without the VITE_ prefix, so Vite never inlines it on its own. Observability uses it
    // to tell preview deploys apart from production; unset (local builds) it resolves to undefined, not a string.
    define: {
        "import.meta.env.VITE_VERCEL_ENV": JSON.stringify(process.env.VERCEL_ENV) ?? "undefined",
    },
    resolve: {
        alias: { "@": new URL("./src", import.meta.url).pathname },
    },
    server: {
        // Mirrors the PostHog rewrites in vercel.json so the /api/pipe relay also works in dev.
        proxy: {
            "/api/pipe/static": {
                target: "https://eu-assets.i.posthog.com",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/pipe\/static/, "/static"),
            },
            "/api/pipe": {
                target: "https://eu.i.posthog.com",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/pipe/, ""),
            },
        },
    },
});
