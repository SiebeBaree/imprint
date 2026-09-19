import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { paths } from "@/config/paths";

export default function HomePage() {
    return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-6">
            <h1 className="text-3xl font-semibold tracking-tight">Todos</h1>
            <p className="text-muted-foreground">
                A deliberately small app demonstrating how this codebase is organized: routes compose, features
                implement, packages carry the shared contracts and infrastructure.
            </p>
            <Button asChild>
                <Link to={paths.todos}>
                    Open todos
                    <ArrowRight data-icon="inline-end" />
                </Link>
            </Button>
        </main>
    );
}
