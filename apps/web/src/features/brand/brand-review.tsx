/* oxlint-disable oxc/no-map-spread -- Preserve immutable database records and React state. */
import type { Brand, BrandProfile } from "@repo/contracts";
import { ArrowRight, Check, ChevronDown, FileText } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { ErrorMessage } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { useAssets } from "@/features/library/api";
import { track } from "@/lib/analytics";

import { useBrandActions, useProducts } from "./api";
const fields = [
    { key: "positioning", label: "Positioning" },
    { key: "audience", label: "Audience" },
    { key: "voice", label: "Voice and captions" },
    { key: "photography", label: "Photography" },
    { key: "fonts", label: "Typography" },
    { key: "productRules", label: "Product details" },
] as const;
export function BrandReview({
    brand,
    onboarding = false,
    onConfirmed,
}: {
    brand: Brand;
    onboarding?: boolean;
    onConfirmed?: () => void;
}) {
    const [profile, setProfile] = useState<BrandProfile | null>(brand.profile);
    const [dirty, setDirty] = useState(false);
    const actions = useBrandActions();
    const { data: products = [] } = useProducts();
    const { data: assets = [] } = useAssets();
    if (!profile) return null;
    const currentProfile = profile;
    function change(update: Partial<BrandProfile>) {
        setProfile({ ...currentProfile, ...update });
        setDirty(true);
    }
    async function save(confirm = false) {
        try {
            const saved = dirty
                ? await actions.saveProfile.mutateAsync({ profile: currentProfile, version: brand.profileVersion })
                : brand;
            if (confirm) {
                await actions.confirm.mutateAsync(saved.profileVersion);
                track("brand_confirmed", { product_count: products.length });
                onConfirmed?.();
            } else toast.success("Brand profile saved. Confirm it before your next campaign.");
            setDirty(false);
        } catch {
            /* The form keeps its edits and displays the request error. */
        }
    }
    return (
        <>
            <div className="brand-review-layout">
                <div className="brand-review-main">
                    {profile.questions.length > 0 && (
                        <section className="review-questions">
                            <h3>Check these details</h3>
                            <ul>
                                {profile.questions.map((question, index) => (
                                    <li key={question}>
                                        {question}
                                        <button
                                            className="text-link"
                                            onClick={() =>
                                                change({ questions: profile.questions.filter((_, i) => i !== index) })
                                            }
                                        >
                                            Resolved
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                    <div className="profile-fields">
                        {fields.map(({ key, label }) => (
                            <section className="profile-field" key={key}>
                                <label htmlFor={`profile-${key}`}>{label}</label>
                                <textarea
                                    id={`profile-${key}`}
                                    value={profile[key].value}
                                    rows={key === "photography" || key === "productRules" ? 5 : 3}
                                    onChange={(event) =>
                                        change({
                                            [key]: { ...profile[key], value: event.target.value, confirmed: true },
                                        })
                                    }
                                />
                                {profile[key].evidence.length > 0 && (
                                    <details className="evidence">
                                        <summary>
                                            <FileText size={13} />
                                            {profile[key].evidence.length}{" "}
                                            {profile[key].evidence.length === 1 ? "reference" : "references"}
                                            <ChevronDown size={13} />
                                        </summary>
                                        <ul>
                                            {profile[key].evidence.map((evidence) => (
                                                <li key={`${evidence.sourceId}-${evidence.detail}`}>
                                                    <span>
                                                        {assets.find((asset) => asset.id === evidence.sourceId)?.name ??
                                                            "Reference"}
                                                    </span>
                                                    {evidence.detail}
                                                </li>
                                            ))}
                                        </ul>
                                    </details>
                                )}
                            </section>
                        ))}
                    </div>
                    <section className="profile-field">
                        <label htmlFor="avoid">Avoid</label>
                        <textarea
                            id="avoid"
                            rows={3}
                            value={profile.avoid.join("\n")}
                            onChange={(event) => change({ avoid: event.target.value.split("\n").filter(Boolean) })}
                        />
                        <p className="field-hint">One rule per line.</p>
                    </section>
                    <section className="profile-field">
                        <h3>Supported claims</h3>
                        {profile.approvedClaims.length ? (
                            profile.approvedClaims.map((claim, index) => (
                                <div className="claim-row" key={claim.claim}>
                                    <span>{claim.claim}</span>
                                    <button
                                        className="text-link"
                                        onClick={() =>
                                            change({
                                                approvedClaims: profile.approvedClaims.filter((_, i) => i !== index),
                                            })
                                        }
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))
                        ) : (
                            <p className="muted">
                                No product claims have been verified. Campaigns will avoid making them.
                            </p>
                        )}
                    </section>
                </div>
                <aside className="brand-review-aside">
                    <section>
                        <h3>Color palette</h3>
                        <div className="palette">
                            {profile.colors.map((color, index) => (
                                <div className="color-entry" key={color.name}>
                                    <svg viewBox="0 0 60 52" aria-label={color.name}>
                                        <rect width="60" height="52" rx="5" fill={color.hex} />
                                    </svg>
                                    <label className="sr-only" htmlFor={`color-${index}`}>
                                        {color.name}
                                    </label>
                                    <input
                                        id={`color-${index}`}
                                        aria-label={`${color.name} hex color`}
                                        value={color.hex}
                                        pattern="#[0-9a-fA-F]{6}"
                                        maxLength={7}
                                        onChange={(event) =>
                                            change({
                                                colors: profile.colors.map((entry, i) =>
                                                    i === index ? { ...entry, hex: event.target.value } : entry,
                                                ),
                                            })
                                        }
                                    />
                                    <span>{color.name}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                    <section>
                        <div className="section-label">
                            <h3>Products</h3>
                            <Link className="text-link" to="/library">
                                Manage
                            </Link>
                        </div>
                        {products.length ? (
                            products.map((product) => {
                                const ref = assets.find((asset) => asset.id === product.primaryAssetId);
                                return (
                                    <div className="product-summary" key={product.id}>
                                        {ref?.url ? (
                                            <img src={ref.url} alt={product.name} />
                                        ) : (
                                            <div className="product-placeholder" />
                                        )}
                                        <div>
                                            <strong>{product.name}</strong>
                                            <span>
                                                {product.referenceCount} reference{" "}
                                                {product.referenceCount === 1 ? "image" : "images"}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="muted">
                                No products were identified. Assign your images to a product in References.
                            </p>
                        )}
                    </section>
                    <section>
                        <h3>Reference images</h3>
                        <div className="brand-moodboard">
                            {assets
                                .filter((asset) => asset.role === "instagram" && asset.url)
                                .slice(0, 6)
                                .map((asset) => (
                                    <img key={asset.id} src={asset.url ?? ""} alt="Brand reference" />
                                ))}
                        </div>
                    </section>
                </aside>
            </div>
            <ErrorMessage error={actions.saveProfile.error || actions.confirm.error} />
            <div className="review-footer">
                <span>
                    {dirty
                        ? "Unsaved changes"
                        : brand.profileConfirmedAt
                          ? "Brand profile confirmed"
                          : "Review your products and any uncertain details before confirming."}
                </span>
                <div>
                    {!onboarding && (
                        <Button
                            variant="outline"
                            disabled={!dirty || actions.saveProfile.isPending}
                            onClick={() => void save()}
                        >
                            Save changes
                        </Button>
                    )}
                    <Button
                        disabled={
                            !products.some((product) => product.referenceCount > 0) ||
                            actions.saveProfile.isPending ||
                            actions.confirm.isPending
                        }
                        onClick={() => void save(true)}
                    >
                        {actions.confirm.isPending ? "Confirming…" : onboarding ? "Confirm brand" : "Confirm profile"}
                        {onboarding ? <ArrowRight size={16} /> : <Check size={16} />}
                    </Button>
                </div>
            </div>
        </>
    );
}
