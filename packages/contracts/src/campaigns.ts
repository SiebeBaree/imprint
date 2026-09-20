import { z } from "zod";

export const dateSchema = z.iso.date();
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time such as 16:00.");
export const campaignStatusSchema = z.enum([
    "queued",
    "planning",
    "generating",
    "checking",
    "ready",
    "needs_attention",
    "failed",
]);
export const createCampaignSchema = z.object({
    brief: z.string().trim().min(15, "Describe what you want the campaign to achieve.").max(5000),
    productId: z.uuid(),
    supportingProductIds: z.array(z.uuid()).max(5).default([]),
    startDate: dateSchema,
    durationDays: z.number().int().min(7).max(28).default(14),
});
export const assetBriefSchema = z.object({
    title: z.string().min(1).max(160),
    format: z.enum(["feed", "story"]),
    concept: z.string().min(1),
    scene: z.string().min(1),
    includesPerson: z.boolean(),
    headline: z.string().max(160),
    caption: z.string().max(2200),
    dayOffset: z.number().int().nonnegative().max(27),
    time: timeSchema,
    referenceIds: z.array(z.uuid()).max(8),
});
export const campaignPlanSchema = z
    .object({
        title: z.string().min(1).max(160),
        goal: z.string(),
        audience: z.string(),
        message: z.string(),
        artDirection: z.string(),
        items: z.array(assetBriefSchema).length(6),
    })
    .superRefine(({ items }, ctx) => {
        if (items.filter((item) => item.format === "feed").length !== 3)
            ctx.addIssue({
                code: "custom",
                path: ["items"],
                message: "A campaign needs three feed images and three stories.",
            });
    });
export const qualityReportSchema = z.object({ passed: z.boolean(), issues: z.array(z.string()).max(12) });
export const imageVersionSchema = z.object({
    id: z.uuid(),
    number: z.number().int(),
    url: z.string().nullable(),
    status: z.enum(["queued", "generating", "checking", "ready", "needs_attention", "failed"]),
    prompt: z.string().nullable(),
    quality: qualityReportSchema.nullable(),
    error: z.string().nullable(),
    createdAt: z.iso.datetime(),
});
export const campaignItemSchema = z.object({
    id: z.uuid(),
    title: z.string(),
    format: z.enum(["feed", "story"]),
    concept: z.string(),
    headline: z.string(),
    caption: z.string(),
    publishDate: dateSchema,
    publishTime: timeSchema,
    status: imageVersionSchema.shape.status,
    currentVersionId: z.uuid().nullable(),
    versions: z.array(imageVersionSchema),
    revision: z.number().int(),
});
export const campaignSchema = z.object({
    id: z.uuid(),
    jobId: z.uuid().nullable(),
    title: z.string(),
    brief: z.string(),
    productId: z.uuid(),
    startDate: dateSchema,
    durationDays: z.number().int(),
    status: campaignStatusSchema,
    stage: z.string(),
    goal: z.string(),
    audience: z.string(),
    message: z.string(),
    readyCount: z.number().int(),
    error: z.string().nullable(),
    coverUrl: z.string().nullable(),
    profileVersion: z.number().int(),
    createdAt: z.iso.datetime(),
    items: z.array(campaignItemSchema),
});
export const campaignListSchema = z.array(campaignSchema.omit({ items: true }));
export const campaignItemParamsSchema = z.object({ id: z.uuid(), itemId: z.uuid() });
export const updateItemSchema = z.object({
    caption: z.string().max(2200),
    publishDate: dateSchema,
    publishTime: timeSchema,
    revision: z.number().int(),
});
export const editImageSchema = z.object({ prompt: z.string().trim().min(3).max(2000), baseVersionId: z.uuid() });
export const restoreImageSchema = z.object({ versionId: z.uuid() });
export const idempotencyHeadersSchema = z.object({ "idempotency-key": z.uuid() });
export const jobSchema = z.object({
    id: z.uuid(),
    kind: z.enum(["instagram", "analysis", "campaign", "edit", "recommendations"]),
    status: z.enum(["queued", "running", "complete", "failed"]),
    stage: z.string(),
    error: z.string().nullable(),
});
export type Campaign = z.infer<typeof campaignSchema>;
export type CampaignItem = z.infer<typeof campaignItemSchema>;
export type CampaignSummary = z.infer<typeof campaignListSchema>[number];
export type CampaignPlan = z.infer<typeof campaignPlanSchema>;
export type AssetBrief = z.infer<typeof assetBriefSchema>;
export type QualityReport = z.infer<typeof qualityReportSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type Job = z.infer<typeof jobSchema>;
