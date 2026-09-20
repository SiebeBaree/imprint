import { useParams } from "react-router";

import { CampaignDetailPage } from "@/features/campaigns/campaign-detail";
export default function CampaignDetail() {
    const { id = "" } = useParams();
    return <CampaignDetailPage id={id} />;
}
