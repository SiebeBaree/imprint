import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { defineConfig } from "@trigger.dev/sdk";
if (existsSync(".env")) loadEnvFile(".env");
const project = process.env.TRIGGER_PROJECT_REF;
if (!project) throw new Error("Set TRIGGER_PROJECT_REF in apps/api/.env before starting Trigger.dev");
export default defineConfig({
    project,
    runtime: "node",
    dirs: ["./src/jobs"],
    maxDuration: 7200,
    retries: { enabledInDev: false, default: { maxAttempts: 1 } },
    build: { external: ["sharp", "pdfjs-dist", "apify-client"] },
});
