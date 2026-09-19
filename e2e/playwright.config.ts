import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

const WEB_PORT = 4173;
const API_PORT = 3001;

type WebServer = Extract<NonNullable<PlaywrightTestConfig["webServer"]>, unknown[]>[number];

// The web app always runs (production build + preview). The api only starts when DATABASE_URL is set; the todos flow
// skips itself without it, the smoke spec runs either way.
const servers: WebServer[] = [
    {
        command: `pnpm --filter web build && pnpm --filter web preview --port ${WEB_PORT} --strictPort`,
        url: `http://localhost:${WEB_PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: { VITE_API_URL: `http://localhost:${API_PORT}` },
    },
    ...(process.env.DATABASE_URL
        ? [
              {
                  command: "pnpm --filter api dev",
                  url: `http://localhost:${API_PORT}/health`,
                  reuseExistingServer: !process.env.CI,
                  timeout: 60_000,
                  env: { PORT: String(API_PORT), CORS_ORIGIN: `http://localhost:${WEB_PORT}` },
              },
          ]
        : []),
];

export default defineConfig({
    testDir: ".",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? "github" : "list",
    use: {
        baseURL: `http://localhost:${WEB_PORT}`,
        trace: "on-first-retry",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: servers,
});
