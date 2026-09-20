import { ClerkProvider, useAuth, useClerk } from "@clerk/react";
import { env } from "@repo/env/web";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

type Session = {
    ready: boolean;
    signedIn: boolean;
    getToken: () => Promise<string | null>;
    signOut: () => Promise<void>;
};
const Context = createContext<Session | null>(null);
function ClerkSession({ children }: { children: ReactNode }) {
    const { isLoaded, isSignedIn, getToken } = useAuth();
    const clerk = useClerk();
    const signOut = useCallback(async () => {
        await clerk.signOut({ redirectUrl: "/sign-in" });
    }, [clerk]);
    const value = useMemo(
        () => ({ ready: Boolean(isLoaded), signedIn: Boolean(isSignedIn), getToken, signOut }),
        [isLoaded, isSignedIn, getToken, signOut],
    );
    return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function AuthProvider({ children }: { children: ReactNode }) {
    return (
        <ClerkProvider
            publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY}
            signInUrl="/sign-in"
            signUpUrl="/sign-in"
            signInFallbackRedirectUrl="/"
            signUpFallbackRedirectUrl="/onboarding"
        >
            <ClerkSession>{children}</ClerkSession>
        </ClerkProvider>
    );
}
export function useSession() {
    const session = useContext(Context);
    if (!session) throw new Error("useSession must be used within AuthProvider");
    return session;
}
export function RequireSession({ children }: { children: ReactNode }) {
    const session = useSession();
    const location = useLocation();
    if (!session.ready) return <output className="full-page-loading">Opening Imprint…</output>;
    if (!session.signedIn) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
    return children;
}
