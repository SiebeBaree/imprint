import { Outlet } from "react-router";

import { RequireSession } from "@/features/auth/auth-context";
export default function Authenticated() {
    return (
        <RequireSession>
            <Outlet />
        </RequireSession>
    );
}
