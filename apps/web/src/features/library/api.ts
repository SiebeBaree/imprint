import { assetListSchema, assetSchema, uploadTicketSchema, uploadSchema } from "@repo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { useApi } from "@/lib/api-client/use-api";
export function useAssets(poll = false) {
    const api = useApi();
    return useQuery({
        queryKey: ["assets"],
        queryFn: () => api("/assets", assetListSchema),
        refetchInterval: poll ? 3000 : false,
        staleTime: 30_000,
    });
}
export function useAssetActions() {
    const api = useApi();
    const client = useQueryClient();
    const invalidate = () => {
        void client.invalidateQueries({ queryKey: ["assets"] });
        void client.invalidateQueries({ queryKey: ["brand"] });
        void client.invalidateQueries({ queryKey: ["products"] });
    };
    return {
        upload: useMutation({
            mutationFn: async ({ file, progress }: { file: File; progress: (percentage: number) => void }) => {
                const input = uploadSchema.parse({ name: file.name, mimeType: file.type, size: file.size });
                const ticket = await api("/assets/upload", uploadTicketSchema, {
                    method: "POST",
                    body: JSON.stringify(input),
                });
                try {
                    await new Promise<void>((resolve, reject) => {
                        const request = new XMLHttpRequest();
                        request.open("PUT", ticket.uploadUrl);
                        for (const [key, value] of Object.entries(ticket.headers)) request.setRequestHeader(key, value);
                        request.timeout = 120_000;
                        request.upload.addEventListener("progress", (event) => {
                            if (event.lengthComputable) progress(Math.round((event.loaded / event.total) * 95));
                        });
                        request.addEventListener("load", () =>
                            request.status >= 200 && request.status < 300
                                ? resolve()
                                : reject(new Error("Upload failed. Check your connection and try again.")),
                        );
                        request.addEventListener("error", () =>
                            reject(new Error("Upload failed. Check your connection and try again.")),
                        );
                        request.addEventListener("timeout", () =>
                            reject(new Error("Upload timed out. Please try again.")),
                        );
                        request.send(file);
                    });
                    const asset = await api(`/assets/${ticket.asset.id}/complete`, assetSchema, { method: "POST" });
                    progress(100);
                    return asset;
                } catch (error) {
                    await api(`/assets/${ticket.asset.id}`, z.void(), { method: "DELETE" }).catch(() => {});
                    throw error;
                }
            },
            onSettled: invalidate,
        }),
        update: useMutation({
            mutationFn: (input: {
                id: string;
                role: "product" | "inspiration" | "logo";
                productId: string | null;
                isPrimary: boolean;
            }) => api(`/assets/${input.id}`, assetSchema, { method: "PATCH", body: JSON.stringify(input) }),
            onSuccess: invalidate,
        }),
        remove: useMutation({
            mutationFn: (id: string) => api(`/assets/${id}`, z.void(), { method: "DELETE" }),
            onSuccess: invalidate,
        }),
    };
}
