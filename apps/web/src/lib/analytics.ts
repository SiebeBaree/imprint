import posthog from "posthog-js";
type AnalyticsEvents = {
    brand_confirmed: { product_count: number };
    campaign_created: { duration_days: number };
    image_edit_requested: { format: "feed" | "story" };
    image_downloaded: { format: "feed" | "story" };
};
export function track<Name extends keyof AnalyticsEvents>(name: Name, properties: AnalyticsEvents[Name]) {
    posthog.capture(name, properties);
}
