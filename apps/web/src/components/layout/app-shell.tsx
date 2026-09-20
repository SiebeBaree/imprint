import { ArrowUpRight, Images, LayoutGrid, LogOut, Menu, Plus, SlidersHorizontal, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { NavLink, Link } from "react-router";

import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/auth-context";
import { useBrand } from "@/features/brand/api";

import { ImprintLogo } from "./primitives";
export function AppShell({ children }: { children: ReactNode }) {
    const { data: brand } = useBrand();
    const session = useSession();
    const [menu, setMenu] = useState(false);
    return (
        <div className="app-shell">
            <header className="mobile-header">
                <Link to="/" aria-label="Imprint home">
                    <ImprintLogo />
                </Link>
                <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setMenu(!menu)}>
                    {menu ? <X /> : <Menu />}
                </Button>
            </header>
            <aside className={`sidebar ${menu ? "is-open" : ""}`}>
                <Link className="sidebar-logo" to="/" onClick={() => setMenu(false)} aria-label="Imprint home">
                    <ImprintLogo />
                </Link>
                <div className="workspace">
                    <div className="workspace-avatar">{brand?.name.slice(0, 1) ?? "I"}</div>
                    <span>{brand?.name ?? "Your brand"}</span>
                </div>
                <Button asChild className="new-campaign-button">
                    <Link to="/campaigns/new" onClick={() => setMenu(false)}>
                        <Plus size={16} />
                        New campaign
                    </Link>
                </Button>
                <nav aria-label="Main navigation">
                    <NavLink to="/" end onClick={() => setMenu(false)}>
                        <LayoutGrid size={17} />
                        Campaigns
                    </NavLink>
                    <NavLink to="/library" onClick={() => setMenu(false)}>
                        <Images size={17} />
                        References
                    </NavLink>
                    <NavLink to="/brand" onClick={() => setMenu(false)}>
                        <SlidersHorizontal size={17} />
                        Brand
                    </NavLink>
                </nav>
                <div className="sidebar-bottom">
                    <Link to="/onboarding" className="setup-link">
                        Brand setup
                        <ArrowUpRight size={15} />
                    </Link>
                    <button className="account-button" onClick={() => void session.signOut()}>
                        <span className="account-avatar">You</span>
                        <span>Your account</span>
                        <LogOut size={15} />
                    </button>
                </div>
            </aside>
            {menu && (
                <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMenu(false)} />
            )}
            <main className="app-main">{children}</main>
        </div>
    );
}
