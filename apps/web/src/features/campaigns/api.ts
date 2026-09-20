import {
    campaignSchema,
    campaignListSchema,
    campaignItemSchema,
    downloadSchema,
    jobSchema,
    type CreateCampaignInput,
} from "@repo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApi } from "@/lib/api-client/use-api";
const running = new Set(["queued", "planning", "generating", "checking"]);
export function useCampaigns() {
    const api = useApi();
    return useQuery({
        queryKey: ["campaigns"],
        queryFn: () => api("/campaigns", campaignListSchema),
        refetchInterval: (query) => (query.state.data?.some((campaign) => running.has(campaign.status)) ? 3000 : false),
    });
}
export function useCampaign(id: string) {
    const api = useApi();
    return useQuery({
        queryKey: ["campaigns", id],
        queryFn: () => api(`/campaigns/${id}`, campaignSchema),
        refetchInterval: (query) =>
            query.state.data &&
            (running.has(query.state.data.status) ||
                query.state.data.items.some((item) => ["queued", "generating", "checking"].includes(item.status)))
                ? 3000
                : false,
    });
}
export function useCampaignActions(id?: string) {
    const api = useApi();
    const client = useQueryClient();
    const invalidate = () => {
        void client.invalidateQueries({ queryKey: ["campaigns"] });
    };
    return {
        create: useMutation({
            mutationFn: ({ input, key }: { input: CreateCampaignInput; key: string }) =>
                api("/campaigns", campaignSchema, {
                    method: "POST",
                    headers: { "idempotency-key": key },
                    body: JSON.stringify(input),
                }),
            onSuccess: invalidate,
        }),
        retry: useMutation({
            mutationFn: () => api(`/campaigns/${id}/retry`, campaignSchema, { method: "POST" }),
            onSuccess: invalidate,
        }),
        save: useMutation({
            mutationFn: (input: {
                itemId: string;
                caption: string;
                publishDate: string;
                publishTime: string;
                revision: number;
            }) =>
                api(`/campaigns/${id}/items/${input.itemId}`, campaignItemSchema, {
                    method: "PATCH",
                    body: JSON.stringify(input),
                }),
            onSuccess: invalidate,
        }),
        edit: useMutation({
            mutationFn: (input: { itemId: string; prompt: string; baseVersionId: string }) =>
                api(`/campaigns/${id}/items/${input.itemId}/edit`, jobSchema, {
                    method: "POST",
                    body: JSON.stringify(input),
                }),
            onSuccess: invalidate,
        }),
        restore: useMutation({
            mutationFn: (input: { itemId: string; versionId: string }) =>
                api(`/campaigns/${id}/items/${input.itemId}/restore`, campaignItemSchema, {
                    method: "POST",
                    body: JSON.stringify(input),
                }),
            onSuccess: invalidate,
        }),
        download: useMutation({
            mutationFn: (itemId: string) => api(`/campaigns/${id}/items/${itemId}/download`, downloadSchema),
        }),
    };
}
