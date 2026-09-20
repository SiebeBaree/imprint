import { ArrowLeft, ArrowRight, Check, Camera } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { ErrorMessage, Field, ImprintLogo, Loading } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBrand, useBrandActions } from "@/features/brand/api";
import { BrandReview } from "@/features/brand/brand-review";
import { useAssets } from "@/features/library/api";
import { FileReady, UploadZone } from "@/features/library/upload-zone";

export function OnboardingPage() {
    const brandQuery = useBrand();
    const brand = brandQuery.data;
    const importing = Boolean(brand && ["queued", "importing"].includes(brand.instagramStatus));
    const { data: assets = [] } = useAssets(importing);
    const actions = useBrandActions();
    const navigate = useNavigate();
    const [name, setName] = useState<string | null>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [editingSources, setEditingSources] = useState(false);
    const images = assets.filter((asset) => ["product", "inspiration", "logo"].includes(asset.role));
    const guidelines = assets.find((asset) => asset.role === "guidelines" && asset.status === "ready");
    const hasInstagram = brand && ["ready", "partial"].includes(brand.instagramStatus);
    const canAnalyze = hasInstagram && guidelines && images.some((asset) => asset.status === "ready");
    const review = brand?.profile && ["review", "ready"].includes(brand.status) && !editingSources;
    async function analyze() {
        if ((name ?? brand?.name) === "Your brand") {
            document.getElementById("brand-name")?.focus();
            return;
        }
        try {
            if (name && name !== brand?.name) await actions.rename.mutateAsync(name);
            await actions.analyze.mutateAsync();
            setEditingSources(false);
        } catch {
            /* Mutation errors are shown beside the action. */
        }
    }
    return (
        <div className="onboarding-page">
            <header className="onboarding-header">
                <Link to="/" aria-label="Imprint home">
                    <ImprintLogo />
                </Link>
                <div className="onboarding-steps">
                    <span className={!review ? "current" : "complete"}>
                        {review ? <Check size={14} /> : <b>1</b>}Brand references
                    </span>
                    <i />
                    <span className={review ? "current" : ""}>
                        <b>2</b>Review your brand
                    </span>
                    <i />
                    <span>
                        <b>3</b>First campaign
                    </span>
                </div>
                <Link className="text-link" to="/">
                    Save and exit
                </Link>
            </header>
            {brandQuery.isPending ? (
                <Loading />
            ) : brandQuery.error ? (
                <ErrorMessage error={brandQuery.error} retry={() => void brandQuery.refetch()} />
            ) : brand?.status === "analyzing" ? (
                <main className="analysis-screen">
                    <div className="analysis-symbol">
                        <ImprintLogo compact />
                    </div>
                    <h1>Getting to know {brand.name}</h1>
                    <p>
                        Reading your guidelines, grouping your products
                        <br />
                        and reviewing your Instagram images.
                    </p>
                    <ol className="analysis-checklist">
                        <li>
                            <Check size={16} />
                            References uploaded
                        </li>
                        <li className="current">
                            <span className="small-dot" />
                            Analyzing your brand
                        </li>
                        <li>
                            <span className="small-dot" />
                            Preparing your brand profile
                        </li>
                    </ol>
                    <p className="muted small">You can leave this page. Your analysis will keep running.</p>
                    <Button variant="outline" asChild>
                        <Link to="/">Back to campaigns</Link>
                    </Button>
                </main>
            ) : review && brand ? (
                <main className="onboarding-review">
                    <button className="back-link" onClick={() => setEditingSources(true)}>
                        <ArrowLeft size={15} />
                        Brand references
                    </button>
                    <h1>Does this look like your brand?</h1>
                    <p className="intro-copy">Review what Imprint found. Your changes will guide every campaign.</p>
                    <BrandReview
                        key={brand.profileVersion}
                        brand={brand}
                        onboarding
                        onConfirmed={() => navigate("/campaigns/new")}
                    />
                </main>
            ) : (
                <main className="onboarding-content">
                    <div className="onboarding-intro">
                        <h1>Start with your brand.</h1>
                        <p>Add the references Imprint needs to create your campaigns.</p>
                    </div>
                    <section className="setup-section">
                        <div className="setup-section-heading">
                            <span className="step-number">01</span>
                            <div>
                                <h2>Your brand</h2>
                                <p>Use the name that appears on your products.</p>
                            </div>
                        </div>
                        <div className="setup-section-body">
                            <Field label="Brand name" htmlFor="brand-name">
                                <Input
                                    id="brand-name"
                                    value={name ?? (brand?.name === "Your brand" ? "" : (brand?.name ?? ""))}
                                    placeholder="Brand name"
                                    maxLength={100}
                                    onChange={(event) => setName(event.target.value)}
                                    onBlur={() => {
                                        if (name?.trim() && name !== brand?.name) actions.rename.mutate(name);
                                    }}
                                />
                            </Field>
                        </div>
                    </section>
                    <section className="setup-section">
                        <div className="setup-section-heading">
                            <span className="step-number">02</span>
                            <div>
                                <h2>Instagram</h2>
                                <p>Import public posts to learn your visual style and tone.</p>
                            </div>
                        </div>
                        <div className="setup-section-body">
                            <label className="sr-only" htmlFor="instagram-url">
                                Instagram profile URL
                            </label>
                            <form
                                className="input-action"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    actions.instagram.mutate(url ?? brand?.instagramUrl ?? "");
                                }}
                            >
                                <div className="input-with-icon">
                                    <Camera size={18} />
                                    <Input
                                        id="instagram-url"
                                        type="url"
                                        placeholder="https://www.instagram.com/yourbrand/"
                                        value={url ?? brand?.instagramUrl ?? ""}
                                        onChange={(event) => setUrl(event.target.value)}
                                        required
                                    />
                                </div>
                                <Button variant="outline" disabled={importing || actions.instagram.isPending}>
                                    {importing ? "Importing…" : hasInstagram ? "Import again" : "Import profile"}
                                </Button>
                            </form>
                            {brand?.instagramMessage ? (
                                <p className={`field-hint ${brand.instagramStatus === "failed" ? "error-text" : ""}`}>
                                    {brand.instagramMessage}
                                </p>
                            ) : (
                                <p className="field-hint">No Instagram login needed. Public profiles only.</p>
                            )}
                            <ErrorMessage error={actions.instagram.error} />
                            {assets.some((asset) => asset.role === "instagram") && (
                                <div className="instagram-strip">
                                    {assets
                                        .filter((asset) => asset.role === "instagram" && asset.url)
                                        .slice(0, 7)
                                        .map((asset) => (
                                            <img
                                                key={asset.id}
                                                src={asset.url ?? ""}
                                                alt="Imported Instagram reference"
                                            />
                                        ))}
                                </div>
                            )}
                        </div>
                    </section>
                    <section className="setup-section">
                        <div className="setup-section-heading">
                            <span className="step-number">03</span>
                            <div>
                                <h2>Brand guidelines</h2>
                                <p>Your colors, fonts, logo rules and anything else to follow.</p>
                            </div>
                        </div>
                        <div className="setup-section-body">
                            {guidelines ? (
                                <>
                                    <FileReady name={guidelines.name} />
                                    <details className="replace-pdf">
                                        <summary>Replace PDF</summary>
                                        <UploadZone pdf />
                                    </details>
                                </>
                            ) : (
                                <UploadZone pdf />
                            )}
                        </div>
                    </section>
                    <section className="setup-section">
                        <div className="setup-section-heading">
                            <span className="step-number">04</span>
                            <div>
                                <h2>Reference images</h2>
                                <p>
                                    Include clear product photos. You can also add past campaigns, logos and company
                                    images.
                                </p>
                            </div>
                        </div>
                        <div className="setup-section-body">
                            <div className="upload-count">
                                <span>Product and brand images</span>
                                <span>{images.length} / 50</span>
                            </div>
                            <UploadZone count={images.length} />
                            {images.length > 0 && (
                                <div className="upload-preview-grid">
                                    {images
                                        .filter((asset) => asset.url)
                                        .slice(0, 12)
                                        .map((asset) => (
                                            <img key={asset.id} src={asset.url ?? ""} alt={asset.name} />
                                        ))}
                                    <Link to="/library" className="manage-references">
                                        Manage
                                        <br />
                                        references
                                        <ArrowRight size={18} />
                                    </Link>
                                </div>
                            )}
                        </div>
                    </section>
                    <ErrorMessage error={actions.analyze.error || actions.rename.error || brand?.error} />
                    <div className="setup-footer">
                        <span>Imprint will group your products and prepare a brand profile.</span>
                        <Button
                            onClick={() => void analyze()}
                            disabled={
                                !canAnalyze ||
                                actions.analyze.isPending ||
                                !(name ?? (brand?.name === "Your brand" ? "" : brand?.name))?.trim()
                            }
                        >
                            {actions.analyze.isPending ? "Starting…" : "Analyze my brand"}
                            <ArrowRight size={16} />
                        </Button>
                    </div>
                </main>
            )}
        </div>
    );
}
