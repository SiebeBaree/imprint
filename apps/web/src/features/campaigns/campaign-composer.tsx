import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Image, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { ErrorMessage, Field, Loading } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { useBrand, useBrandActions, useProducts } from "@/features/brand/api";
import { useAssets } from "@/features/library/api";
import { track } from "@/lib/analytics";
import { today } from "@/lib/dates";

import { useCampaignActions } from "./api";
export function CampaignComposer() {
    const { data: brand, isPending: brandPending } = useBrand();
    const { data: products = [] } = useProducts();
    const { data: assets = [] } = useAssets();
    const [brief, setBrief] = useState("");
    const [productId, setProductId] = useState("");
    const [supporting, setSupporting] = useState<string[]>([]);
    const [startDate, setStartDate] = useState(today);
    const [durationDays, setDurationDays] = useState(14);
    const [key, setKey] = useState(() => crypto.randomUUID());
    const [supportOpen, setSupportOpen] = useState(false);
    const brandActions = useBrandActions();
    const actions = useCampaignActions();
    const navigate = useNavigate();
    const chosen = products.find((product) => product.id === productId) ?? products[0];
    const cover = assets.find((asset) => asset.id === chosen?.primaryAssetId);
    function updateBrief(value: string) {
        setBrief(value);
        setKey(crypto.randomUUID());
    }
    async function submit() {
        if (!chosen) return;
        try {
            const campaign = await actions.create.mutateAsync({
                input: {
                    brief,
                    productId: chosen.id,
                    supportingProductIds: supporting.filter((id) => id !== chosen.id),
                    startDate,
                    durationDays,
                },
                key,
            });
            track("campaign_created", { duration_days: durationDays });
            navigate(`/campaigns/${campaign.id}`);
        } catch {
            /* Keep the idempotency key for safe retries. */
        }
    }
    if (brandPending) return <Loading />;
    if (brand?.status !== "ready")
        return (
            <div className="page-container">
                <div className="empty-state">
                    <h1>Confirm your brand first</h1>
                    <p>Review your brand profile so Imprint can use the right style and products.</p>
                    <Button asChild>
                        <Link to="/onboarding">
                            Review brand
                            <ArrowRight size={16} />
                        </Link>
                    </Button>
                </div>
            </div>
        );
    return (
        <div className="composer-page">
            <Link className="back-link" to="/">
                <ArrowLeft size={15} />
                Campaigns
            </Link>
            <header className="composer-header">
                <h1>What's the next campaign?</h1>
                <p>Tell us what you want people to see, feel or do.</p>
            </header>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                }}
            >
                <div className="composer-box">
                    <label className="sr-only" htmlFor="campaign-brief">
                        Campaign brief
                    </label>
                    <textarea
                        id="campaign-brief"
                        placeholder="Introduce a new product, give people a reason to try it or show a different way to enjoy it…"
                        value={brief}
                        onChange={(event) => updateBrief(event.target.value)}
                        minLength={15}
                        maxLength={5000}
                        required
                    />
                    <div className="composer-product">
                        <div className="selected-product">
                            {cover?.url ? <img src={cover.url} alt="" /> : <Image size={18} />}
                            <div>
                                <span>Promoted product</span>
                                <select
                                    aria-label="Promoted product"
                                    value={chosen?.id ?? ""}
                                    onChange={(event) => {
                                        setProductId(event.target.value);
                                        setKey(crypto.randomUUID());
                                    }}
                                >
                                    {products.map((product) => (
                                        <option key={product.id} value={product.id}>
                                            {product.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <ChevronDown size={14} />
                        </div>
                        {products.length > 1 && (
                            <button
                                className="support-product-button"
                                type="button"
                                onClick={() => setSupportOpen(!supportOpen)}
                            >
                                <Plus size={14} />
                                {supporting.length ? `${supporting.length} supporting product` : "Supporting product"}
                            </button>
                        )}
                    </div>
                    {supportOpen && (
                        <div className="supporting-products">
                            {products
                                .filter((product) => product.id !== chosen?.id)
                                .map((product) => (
                                    <label className="checkbox-label" key={product.id}>
                                        <input
                                            type="checkbox"
                                            checked={supporting.includes(product.id)}
                                            onChange={(event) => {
                                                setSupporting(
                                                    event.target.checked
                                                        ? [...supporting, product.id]
                                                        : supporting.filter((id) => id !== product.id),
                                                );
                                                setKey(crypto.randomUUID());
                                            }}
                                        />
                                        {product.name}
                                    </label>
                                ))}
                        </div>
                    )}
                </div>
                {brand.suggestionsStatus === "queued" && (
                    <output className="ideas-status">Preparing three campaign ideas for your brand…</output>
                )}
                {brand.suggestionsStatus === "failed" && (
                    <div className="ideas-status">
                        Campaign ideas could not be loaded.{" "}
                        <button
                            type="button"
                            className="text-link"
                            onClick={() => brandActions.recommendations.mutate()}
                        >
                            Try again
                        </button>
                    </div>
                )}
                {brand.suggestions.length > 0 && (
                    <section className="campaign-ideas">
                        <h2>Or start with an idea for {brand.name}</h2>
                        <div className="suggestion-grid">
                            {brand.suggestions.map((suggestion, index) => (
                                <button
                                    type="button"
                                    key={suggestion.title}
                                    className={brief === suggestion.brief ? "selected" : ""}
                                    onClick={() => {
                                        updateBrief(suggestion.brief);
                                        setProductId(suggestion.productId);
                                    }}
                                >
                                    <span className="suggestion-number">0{index + 1}</span>
                                    <h3>{suggestion.title}</h3>
                                    <p>{suggestion.brief}</p>
                                    {brief === suggestion.brief ? <Check size={17} /> : <ArrowRight size={17} />}
                                </button>
                            ))}
                        </div>
                    </section>
                )}
                <div className="campaign-settings">
                    <Field label="Start date" htmlFor="campaign-start">
                        <div className="date-field">
                            <CalendarDays size={16} />
                            <input
                                id="campaign-start"
                                type="date"
                                value={startDate}
                                onChange={(event) => {
                                    setStartDate(event.target.value);
                                    setKey(crypto.randomUUID());
                                }}
                                required
                            />
                        </div>
                    </Field>
                    <Field label="Duration" htmlFor="campaign-duration">
                        <select
                            id="campaign-duration"
                            value={durationDays}
                            onChange={(event) => {
                                setDurationDays(Number(event.target.value));
                                setKey(crypto.randomUUID());
                            }}
                        >
                            <option value="7">1 week</option>
                            <option value="14">2 weeks</option>
                            <option value="21">3 weeks</option>
                            <option value="28">4 weeks</option>
                        </select>
                    </Field>
                    <div className="campaign-deliverables">
                        <span>Included in your campaign</span>
                        <p>
                            3 feed images <span>·</span> 3 stories
                        </p>
                        <small>Captions and a posting schedule</small>
                    </div>
                </div>
                <ErrorMessage error={actions.create.error} />
                <div className="composer-footer">
                    <p>You can edit every image and caption after generation.</p>
                    <Button
                        size="lg"
                        type="submit"
                        disabled={!chosen || brief.trim().length < 15 || actions.create.isPending}
                    >
                        {actions.create.isPending ? "Starting campaign…" : "Create campaign"}
                        <ArrowRight size={16} />
                    </Button>
                </div>
            </form>
        </div>
    );
}
