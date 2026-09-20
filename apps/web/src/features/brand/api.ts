import { brandSchema, jobSchema, productListSchema, productSchema, type BrandProfile } from "@repo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useApi } from "@/lib/api-client/use-api";
export function useBrand() {
    const api = useApi();
    return useQuery({
        queryKey: ["brand"],
        queryFn: () => api("/brand", brandSchema),
        refetchInterval: (query) =>
            query.state.data &&
            (query.state.data.status === "analyzing" ||
                query.state.data.suggestionsStatus === "queued" ||
                ["queued", "importing"].includes(query.state.data.instagramStatus))
                ? 3000
                : false,
    });
}
export function useProducts() {
    const api = useApi();
    return useQuery({ queryKey: ["products"], queryFn: () => api("/products", productListSchema) });
}
export function useBrandActions() {
    const api = useApi();
    const client = useQueryClient();
    const invalidate = () => {
        void client.invalidateQueries({ queryKey: ["brand"] });
        void client.invalidateQueries({ queryKey: ["products"] });
        void client.invalidateQueries({ queryKey: ["assets"] });
    };
    return {
        recommendations: useMutation({
            mutationFn: () => api("/brand/recommendations", brandSchema, { method: "POST" }),
            onSuccess: invalidate,
        }),
        rename: useMutation({
            mutationFn: (name: string) =>
                api("/brand", brandSchema, { method: "PATCH", body: JSON.stringify({ name }) }),
            onSuccess: invalidate,
        }),
        instagram: useMutation({
            mutationFn: (url: string) =>
                api("/brand/instagram", jobSchema, { method: "POST", body: JSON.stringify({ url }) }),
            onSuccess: invalidate,
        }),
        analyze: useMutation({
            mutationFn: () => api("/brand/analyze", jobSchema, { method: "POST" }),
            onSuccess: invalidate,
        }),
        saveProfile: useMutation({
            mutationFn: (input: { profile: BrandProfile; version: number }) =>
                api("/brand/profile", brandSchema, { method: "PATCH", body: JSON.stringify(input) }),
            onSuccess: invalidate,
        }),
        confirm: useMutation({
            mutationFn: (version: number) =>
                api("/brand/confirm", brandSchema, { method: "POST", body: JSON.stringify({ version }) }),
            onSuccess: invalidate,
        }),
        saveProduct: useMutation({
            mutationFn: (input: { id?: string; name: string; description: string; packaging: string }) =>
                api(input.id ? `/products/${input.id}` : "/products", productSchema, {
                    method: input.id ? "PATCH" : "POST",
                    body: JSON.stringify(input),
                }),
            onSuccess: invalidate,
        }),
    };
}
