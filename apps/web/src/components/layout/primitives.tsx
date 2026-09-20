import { AlertCircle, ArrowUpRight, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
export function ImprintLogo({ compact = false }: { compact?: boolean }) {
    return (
        <span className="imprint-logo">
            <svg viewBox="0 0 30 30" aria-hidden="true">
                <path d="M5 3h7v24H5zM15 3h10v7H15zM15 13h7v14h-7z" fill="currentColor" />
            </svg>
            {!compact && <span>imprint</span>}
        </span>
    );
}
export function PageHeader({
    title,
    description,
    action,
    breadcrumb,
}: {
    title: string;
    description?: string;
    action?: ReactNode;
    breadcrumb?: ReactNode;
}) {
    return (
        <header className="page-header">
            {breadcrumb && <div className="breadcrumbs">{breadcrumb}</div>}
            <div className="page-heading">
                <div>
                    <h1>{title}</h1>
                    {description && <p>{description}</p>}
                </div>
                {action}
            </div>
        </header>
    );
}
export function ErrorMessage({ error, retry }: { error: unknown; retry?: () => void }) {
    if (!error) return null;
    return (
        <div className="error-message" role="alert">
            <AlertCircle size={17} />
            <div>
                <p>{error instanceof Error ? error.message : String(error)}</p>
                {retry && (
                    <button className="text-link" onClick={retry}>
                        Try again
                    </button>
                )}
            </div>
        </div>
    );
}
export function Loading({ label = "Loading…" }: { label?: string }) {
    return (
        <output className="loading-state">
            <div className="loading-line" />
            <p>{label}</p>
        </output>
    );
}
export function Modal({
    open,
    onOpenChange,
    title,
    description,
    children,
    className = "",
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: ReactNode;
    className?: string;
}) {
    useEffect(() => {
        if (!open) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, [open]);
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                {/* The static overlay avoids runtime styles from react-remove-scroll under the strict CSP. */}
                <div className="dialog-overlay" />
                <Dialog.Content className={`dialog-content ${className}`} aria-describedby={undefined}>
                    <div className="dialog-heading">
                        <div>
                            <Dialog.Title>{title}</Dialog.Title>
                            {description && <Dialog.Description>{description}</Dialog.Description>}
                        </div>
                        <Dialog.Close asChild>
                            <Button variant="ghost" size="icon" aria-label="Close">
                                <X />
                            </Button>
                        </Dialog.Close>
                    </div>
                    {children}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <a className="text-link inline-link" href={href} target="_blank" rel="noreferrer">
            {children}
            <ArrowUpRight size={14} />
        </a>
    );
}
export function Field({
    label,
    htmlFor,
    children,
    hint,
}: {
    label: string;
    htmlFor?: string;
    children: ReactNode;
    hint?: string;
}) {
    return (
        <div className="field">
            <label htmlFor={htmlFor}>{label}</label>
            {children}
            {hint && <p className="field-hint">{hint}</p>}
        </div>
    );
}
