import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";
export default [
    route("sign-in", "./routes/sign-in/page.tsx"),
    route("sso-callback", "./routes/sign-in/callback.tsx"),
    layout("./routes/authenticated.tsx", [
        route("onboarding", "./routes/onboarding/page.tsx"),
        layout("./routes/workspace.tsx", [
            index("./routes/page.tsx"),
            route("brand", "./routes/brand/page.tsx"),
            route("library", "./routes/library/page.tsx"),
            route("campaigns/new", "./routes/campaigns/new.tsx"),
            route("campaigns/:id", "./routes/campaigns/detail.tsx"),
        ]),
    ]),
] satisfies RouteConfig;
