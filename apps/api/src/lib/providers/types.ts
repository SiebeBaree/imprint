import type { BrandProfile, CampaignPlan, QualityReport, Suggestion } from "@repo/contracts";
import { profileSchema } from "@repo/contracts";
import type { AssetRow, BrandRow, CampaignRow, ProductRow } from "@repo/db";
import { z } from "zod";
export const analysisSchema = z.object({
    profile: profileSchema,
    groups: z
        .array(
            z.object({
                name: z.string(),
                description: z.string(),
                packaging: z.string(),
                assetIds: z.array(z.uuid()).min(1),
            }),
        )
        .max(30),
    classification: z.array(z.object({ assetId: z.uuid(), role: z.enum(["inspiration", "logo"]) })),
});
export type ImageInput = {
    prompt: string;
    format: "feed" | "story";
    includesPerson: boolean;
    references: AssetRow[];
    source?: Uint8Array;
};
export type AiService = {
    analyze(
        brand: BrandRow,
        files: AssetRow[],
        products: ProductRow[],
        jobId: string,
    ): Promise<z.infer<typeof analysisSchema>>;
    recommend(profile: BrandProfile, products: ProductRow[], jobId: string): Promise<Suggestion[]>;
    plan(campaign: CampaignRow, files: AssetRow[], products: ProductRow[], jobId: string): Promise<CampaignPlan>;
    image(input: ImageInput, jobId: string): Promise<Uint8Array>;
    check(image: Uint8Array, references: AssetRow[], profile: BrandProfile, jobId: string): Promise<QualityReport>;
};
export type InstagramPost = { id: string; url: string; caption: string; images: string[] };
export type InstagramService = {
    start(url: string): Promise<string>;
    result(runId: string): Promise<{
        status: "running" | "complete" | "failed";
        posts: InstagramPost[];
        partial: boolean;
        message: string;
    }>;
};
