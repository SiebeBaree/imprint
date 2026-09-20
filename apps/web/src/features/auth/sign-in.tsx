import { AuthenticateWithRedirectCallback, useSignIn } from "@clerk/react";
import { useState } from "react";
import { Link, Navigate } from "react-router";

import { ErrorMessage, ImprintLogo } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";

import { useSession } from "./auth-context";
function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
                fill="#4285F4"
                d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
            />
            <path
                fill="#34A853"
                d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.97-3.38.97-2.6 0-4.82-1.76-5.61-4.13H3.05v2.59A10 10 0 0 0 12 22Z"
            />
            <path fill="#FBBC05" d="M6.39 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.34-2.59Z" />
            <path
                fill="#EA4335"
                d="M12 5.95c1.47 0 2.79.5 3.82 1.5l2.87-2.88A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.34 2.59A5.98 5.98 0 0 1 12 5.95Z"
            />
        </svg>
    );
}
function LiveGoogleButton() {
    const { signIn } = useSignIn();
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    async function start() {
        setPending(true);
        setError(null);
        try {
            const result = await signIn.sso({
                strategy: "oauth_google",
                redirectUrl: "/",
                redirectCallbackUrl: "/sso-callback",
            });
            if (result.error) {
                setError(result.error.message ?? "Google sign-in could not start.");
                setPending(false);
            }
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Google sign-in could not start.");
            setPending(false);
        }
    }
    return (
        <>
            <Button className="google-button" variant="outline" onClick={() => void start()} disabled={pending}>
                <GoogleIcon />
                {pending ? "Opening Google…" : "Continue with Google"}
            </Button>
            <div id="clerk-captcha" />
            <ErrorMessage error={error} />
        </>
    );
}
export function SignInPage() {
    const { signedIn } = useSession();
    if (signedIn) return <Navigate to="/" replace />;
    return (
        <main className="sign-in-page">
            <div className="sign-in-main">
                <Link to="/sign-in" className="sign-in-logo" aria-label="Imprint">
                    <ImprintLogo />
                </Link>
                <div className="sign-in-form">
                    <h1>
                        Your products.
                        <br />
                        Your next campaign.
                    </h1>
                    <p>
                        Create campaign images and captions
                        <br className="desktop-break" /> that look like your brand.
                    </p>
                    <div className="auth-action">
                        <LiveGoogleButton />
                    </div>
                    <p className="auth-footnote">One account for your brand, references and campaigns.</p>
                </div>
                <footer>Imprint</footer>
            </div>
            <div className="sign-in-art" aria-hidden="true">
                <div className="art-grid" />
                <div className="impression impression-back">
                    <ImprintLogo compact />
                </div>
                <div className="impression impression-front">
                    <ImprintLogo compact />
                </div>
                <div className="art-caption">
                    <span>Imprint</span>
                </div>
            </div>
        </main>
    );
}
export function AuthCallback() {
    return (
        <div className="full-page-loading">
            <AuthenticateWithRedirectCallback
                signInUrl="/sign-in"
                signUpUrl="/sign-in"
                signInFallbackRedirectUrl="/"
                signUpFallbackRedirectUrl="/onboarding"
            />
        </div>
    );
}
