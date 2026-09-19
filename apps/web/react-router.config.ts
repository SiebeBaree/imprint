import type { Config } from "@react-router/dev/config";

export default {
    appDirectory: "src/app",
    // Pure SPA: the api owns all server concerns.
    ssr: false,
} satisfies Config;
