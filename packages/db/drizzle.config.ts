import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { defineConfig } from "drizzle-kit";

// pnpm runs this package from packages/db. Share the API's database configuration.
if (existsSync("../../apps/api/.env")) loadEnvFile("../../apps/api/.env");

export default defineConfig({
    schema: "./src/schema.ts",
    out: "./migrations",
    dialect: "postgresql",
    casing: "snake_case",
    dbCredentials: {
        // Only needed for db:migrate / db:studio, not for db:generate.
        url: process.env.DATABASE_URL ?? "",
    },
});
