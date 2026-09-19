import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    test: {
        include: ["src/**/*.test.{ts,tsx}"],
        environment: "jsdom",
        // Required for Testing Library's automatic DOM cleanup between tests.
        globals: true,
        setupFiles: ["./src/test-setup.ts"],
    },
    resolve: {
        alias: { "@": new URL("./src", import.meta.url).pathname },
    },
});
