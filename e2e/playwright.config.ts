import { defineConfig, devices } from "@playwright/test";

if (!process.env.E2E_STORAGE_STATE || !process.env.E2E_CAMPAIGN_ID) {
    throw new Error(
        "Live browser tests require E2E_STORAGE_STATE and E2E_CAMPAIGN_ID. Start pnpm dev, then use an authenticated Clerk session and a real generated campaign.",
    );
}
export default defineConfig({
    testDir: ".",
    workers: 1,
    fullyParallel: false,
    timeout: 1_200_000,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    reporter: "list",
    use: {
        baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
        storageState: process.env.E2E_STORAGE_STATE,
        trace: "off",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
