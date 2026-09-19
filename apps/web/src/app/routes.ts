import { index, route, type RouteConfig } from "@react-router/dev/routes";

// One line per page; folders under routes/ mirror the URL structure.
export default [index("./routes/page.tsx"), route("todos", "./routes/todos/page.tsx")] satisfies RouteConfig;
