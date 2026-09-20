import { ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router";

import { PageHeader, ErrorMessage, Loading } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { useBrand } from "@/features/brand/api";
import { formatDate } from "@/lib/dates";

import { useCampaigns } from "./api";
export function CampaignListPage() {
    const query = useCampaigns();
    const { data: brand } = useBrand();
    return (
        <div className="page-container">
            <PageHeader
                title="Campaigns"

                action={
                    <Button asChild>
                        <Link to="/campaigns/new">
                            <Plus size={16} />
                            New campaign
                        </Link>
                    </Button>
                }
            />
            {brand && brand.status !== "ready" && (
                <div className="setup-notice">
                    <div>
                        <strong>
                            {brand.profile
                                ? "Review your brand before creating a campaign"
                                : "Set up your brand to get started"}
                        </strong>
                        <p>
                            {brand.profile
                                ? "Your references or brand profile have changed."
                                : "Add your Instagram profile, guidelines and product images."}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link to="/onboarding">
                            {brand.profile ? "Review brand" : "Set up brand"}
                            <ArrowRight size={16} />
                        </Link>
                    </Button>
                </div>
            )}
            {query.isPending ? (
                <Loading label="Loading campaigns…" />
            ) : query.error ? (
                <ErrorMessage error={query.error} retry={() => void query.refetch()} />
            ) : query.data.length ? (
                <div className="campaign-list-grid">
                    {query.data.map((campaign) => (
                        <Link className="campaign-card" key={campaign.id} to={`/campaigns/${campaign.id}`}>
                            <div className="campaign-card-cover">
                                {campaign.coverUrl ? (
                                    <img src={campaign.coverUrl} alt={campaign.title} />
                                ) : (
                                    <div className="campaign-cover-placeholder">
                                        <span>imprint</span>
                                    </div>
                                )}
                                <span className="campaign-card-open">
                                    <ArrowRight size={19} />
                                </span>
                            </div>
                            <div className="campaign-card-title">
                                <h2>{campaign.title}</h2>
                                {["ready", "needs_attention"].includes(campaign.status) ? (
                                    <span
                                        className={
                                            campaign.status === "needs_attention" ? "attention-text" : "ready-label"
                                        }
                                    >
                                        {campaign.status === "ready" ? "Ready" : "Needs review"}
                                    </span>
                                ) : (
                                    <span className="muted small">
                                        {campaign.status === "failed" ? "Paused" : "In progress"}
                                    </span>
                                )}
                            </div>
                            <p>
                                {formatDate(campaign.startDate)} · {campaign.durationDays} days · {campaign.readyCount}{" "}
                                of 6 images ready
                            </p>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="campaign-empty">
                    <div className="empty-composition">
                        <div />
                        <div />
                        <div />
                    </div>
                    <h2>Create your first campaign</h2>
                    <p>Choose a product and tell Imprint what you want to achieve.</p>
                    <Button asChild>
                        <Link to={brand?.status === "ready" ? "/campaigns/new" : "/onboarding"}>
                            {brand?.status === "ready" ? "Create a campaign" : "Set up your brand"}
                            <ArrowRight size={16} />
                        </Link>
                    </Button>
                </div>
            )}
        </div>
    );
}
