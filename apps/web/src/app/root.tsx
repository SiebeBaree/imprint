import "@/lib/observability";
import "@/styles/globals.css";
import * as Sentry from "@sentry/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from "react-router";

import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/features/auth/auth-context";
import { createQueryClient } from "@/lib/query-client";

export function meta() {
    return [{ title: "Imprint" }, { name: "description", content: "Marketing campaigns for your physical products." }];
}

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <Meta />
                <Links />
            </head>
            <body className="min-h-dvh font-sans antialiased">
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    // useState so the client is created once per browser session.
    const [queryClient] = useState(createQueryClient);

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <Outlet />
            </AuthProvider>
            <Toaster />
        </QueryClientProvider>
    );
}

export function ErrorBoundary() {
    const error = useRouteError();

    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <main className="mx-auto flex max-w-md flex-col items-start gap-4 px-6 py-16">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">The error has been reported. Please reload the page.</p>
        </main>
    );
}
