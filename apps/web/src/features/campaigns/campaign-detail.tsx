import type { Campaign } from "@repo/contracts";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronRight, CircleAlert, Image, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import { PageHeader, ErrorMessage, Loading, ImprintLogo } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/dates";

import { useCampaign, useCampaignActions } from "./api";
import { ImageEditor } from "./image-editor";
const running = new Set(["queued", "planning", "generating", "checking"]);
function CampaignProgress({ campaign }: { campaign: Campaign }) {
    const steps = [
        {
            label: "Plan your campaign",
            complete: campaign.status !== "queued" && campaign.status !== "planning",
            current: ["queued", "planning"].includes(campaign.status),
        },
        { label: "Create the images", complete: campaign.readyCount === 6, current: campaign.status === "generating" },
        { label: "Check product details", complete: false, current: campaign.status === "checking" },
    ];
    return (
        <div className="campaign-progress">
            <Link className="back-link" to="/">
                <ArrowLeft size={15} />
                Campaigns
            </Link>
            <div className="progress-content">
                <div className="progress-imprint">
                    <ImprintLogo compact />
                </div>
                <h1>Creating your campaign</h1>
                <p>{campaign.stage}</p>
                <div className="progress-frames" aria-label={`${campaign.readyCount} of 6 images ready`}>
                    {Array.from({ length: 6 }, (_, index) => (
                        <div className={index < campaign.readyCount ? "complete" : ""} key={index}>
                            {index < campaign.readyCount ? (
                                <Check size={24} />
                            ) : (
                                <span>{String(index + 1).padStart(2, "0")}</span>
                            )}
                        </div>
                    ))}
                </div>
                <ol className="progress-steps">
                    {steps.map((step) => (
                        <li key={step.label} className={step.complete ? "complete" : step.current ? "current" : ""}>
                            {step.complete ? <Check size={16} /> : <span className="small-dot" />}
                            {step.label}
                        </li>
                    ))}
                </ol>
                <p className="progress-brief">{campaign.brief}</p>
                <p className="muted small">Generation can take several minutes. You can leave and come back.</p>
                <Button variant="outline" asChild>
                    <Link to="/">Back to campaigns</Link>
                </Button>
            </div>
        </div>
    );
}
export function CampaignDetailPage({ id }: { id: string }) {
    const query = useCampaign(id);
    const actions = useCampaignActions(id);
    const [tab, setTab] = useState("all");
    const [view, setView] = useState("images");
    const [params, setParams] = useSearchParams();
    const [showBrief, setShowBrief] = useState(false);
    const campaign = query.data;
    if (query.isPending) return <Loading label="Loading campaign…" />;
    if (query.error)
        return (
            <div className="page-container">
                <ErrorMessage error={query.error} retry={() => void query.refetch()} />
            </div>
        );
    if (!campaign) return null;
    if (running.has(campaign.status)) return <CampaignProgress campaign={campaign} />;
    const selected = campaign.items.find((item) => item.id === params.get("image"));
    const items = campaign.items.filter((item) => tab === "all" || item.format === tab);
    return (
        <div className="page-container campaign-detail">
            <PageHeader
                title={campaign.title}
                breadcrumb={
                    <Link to="/">
                        Campaigns
                        <ChevronRight size={13} />
                    </Link>
                }
                description={`${formatDate(campaign.startDate)} · ${campaign.durationDays} days · Instagram`}
                action={
                    <Button variant="outline" onClick={() => setShowBrief(!showBrief)}>
                        {showBrief ? "Hide brief" : "Campaign brief"}
                    </Button>
                }
            />
            {showBrief && (
                <section className="campaign-brief-panel">
                    <div>
                        <h3>Goal</h3>
                        <p>{campaign.goal}</p>
                    </div>
                    <div>
                        <h3>Audience</h3>
                        <p>{campaign.audience}</p>
                    </div>
                    <div>
                        <h3>Message</h3>
                        <p>{campaign.message}</p>
                    </div>
                    <p className="original-brief">{campaign.brief}</p>
                </section>
            )}
            {campaign.status === "failed" && (
                <div className="campaign-failure">
                    <ErrorMessage error={campaign.error} />
                    <Button onClick={() => actions.retry.mutate()} disabled={actions.retry.isPending}>
                        Retry unfinished images
                        <ArrowRight size={16} />
                    </Button>
                    <ErrorMessage error={actions.retry.error} />
                </div>
            )}
            {campaign.status === "needs_attention" && (
                <div className="attention-notice">
                    <CircleAlert size={17} />
                    <p>Some images need a closer look. Open a flagged image to review the issue and request an edit.</p>
                </div>
            )}
            <div className="gallery-toolbar">
                <div className="tabs" role="tablist" aria-label="Post format">
                    {[
                        ["all", "All posts"],
                        ["feed", "Feed"],
                        ["story", "Stories"],
                    ].map(([key, label]) => (
                        <button role="tab" aria-selected={tab === key} key={key} onClick={() => setTab(key ?? "all")}>
                            {label}
                            <span>{campaign.items.filter((item) => key === "all" || item.format === key).length}</span>
                        </button>
                    ))}
                </div>
                <div className="view-switch" aria-label="Campaign view">
                    <button aria-label="Image view" aria-pressed={view === "images"} onClick={() => setView("images")}>
                        <Image size={16} />
                    </button>
                    <button
                        aria-label="Posting schedule"
                        aria-pressed={view === "schedule"}
                        onClick={() => setView("schedule")}
                    >
                        <CalendarDays size={16} />
                    </button>
                </div>
            </div>
            {view === "images" ? (
                <div className="campaign-image-grid">
                    {items.map((item) => {
                        const version = item.versions.find((entry) => entry.id === item.currentVersionId);
                        return (
                            <button
                                className={`campaign-image ${item.format}`}
                                key={item.id}
                                onClick={() => setParams({ image: item.id })}
                            >
                                <div className="campaign-image-preview">
                                    {version?.url ? (
                                        <img src={version.url} alt={item.title} loading="lazy" />
                                    ) : (
                                        <div className="unavailable-image">
                                            <Image size={25} />
                                            <span>{item.status === "failed" ? "Image paused" : "Creating image"}</span>
                                        </div>
                                    )}
                                    <span className="image-open">
                                        <Plus size={19} />
                                    </span>
                                    {item.status === "needs_attention" && (
                                        <span className="review-flag">
                                            <CircleAlert size={14} />
                                            Review image
                                        </span>
                                    )}
                                </div>
                                <div className="post-meta">
                                    <span>{item.format === "feed" ? "Feed" : "Story"}</span>
                                    <span>
                                        {formatDate(item.publishDate)} · {formatTime(item.publishTime)}
                                    </span>
                                </div>
                                <h2>{item.title}</h2>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="schedule-list">
                    <div className="schedule-intro">
                        <h2>Posting schedule</h2>
                        <p>Suggested times. Download each image and post it on Instagram.</p>
                    </div>
                    {items
                        .toSorted((a, b) =>
                            `${a.publishDate}${a.publishTime}`.localeCompare(`${b.publishDate}${b.publishTime}`),
                        )
                        .map((item) => {
                            const version = item.versions.find((entry) => entry.id === item.currentVersionId);
                            return (
                                <button
                                    className="schedule-row"
                                    key={item.id}
                                    onClick={() => setParams({ image: item.id })}
                                >
                                    <div className="schedule-date">
                                        <strong>
                                            {formatDate(item.publishDate, {
                                                weekday: "short",
                                                month: undefined,
                                                day: "numeric",
                                            })}
                                        </strong>
                                        <span>{formatTime(item.publishTime)}</span>
                                    </div>
                                    {version?.url ? (
                                        <img src={version.url} alt={item.title} />
                                    ) : (
                                        <div className="product-placeholder">
                                            <Image size={20} />
                                        </div>
                                    )}
                                    <div>
                                        <span className="muted small">Instagram {item.format}</span>
                                        <h3>{item.title}</h3>
                                        <p>{item.caption}</p>
                                    </div>
                                    <ArrowRight size={18} />
                                </button>
                            );
                        })}
                </div>
            )}
            <p className="campaign-bottom-note">
                Made with brand profile v{campaign.profileVersion}. Images and captions are ready for your review.
            </p>
            {selected && (
                <ImageEditor key={selected.id} campaign={campaign} item={selected} close={() => setParams({})} />
            )}
        </div>
    );
}
