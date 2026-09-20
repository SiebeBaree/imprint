import { Outlet } from "react-router";

import { AppShell } from "@/components/layout/app-shell";
export default function Workspace() {
    return (
        <AppShell>
            <Outlet />
        </AppShell>
    );
}
