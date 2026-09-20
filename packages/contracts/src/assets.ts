import { z } from "zod";

export const assetRoleSchema = z.enum(["product", "inspiration", "logo", "guidelines", "instagram", "generated"]);
export const assetSchema = z.object({
    id: z.uuid(),
    brandId: z.uuid(),
    name: z.string(),
    mimeType: z.string(),
    role: assetRoleSchema,
    status: z.enum(["uploading", "processing", "ready", "failed"]),
    url: z.string().nullable(),
    width: z.number().nullable(),
    height: z.number().nullable(),
    productId: z.uuid().nullable(),
    isPrimary: z.boolean(),
    caption: z.string().nullable(),
    error: z.string().nullable(),
    createdAt: z.iso.datetime(),
});
export const assetListSchema = z.array(assetSchema);
export const uploadSchema = z
    .object({
        name: z.string().trim().min(1).max(200),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
        size: z
            .number()
            .int()
            .min(1)
            .max(25 * 1024 * 1024),
    })
    .superRefine((input, ctx) => {
        if (input.mimeType !== "application/pdf" && input.size > 20 * 1024 * 1024)
            ctx.addIssue({ code: "custom", path: ["size"], message: "Images must be smaller than 20 MB." });
    });
export const uploadTicketSchema = z.object({
    asset: assetSchema,
    uploadUrl: z.url(),
    headers: z.record(z.string(), z.string()),
});
export const updateAssetSchema = z.object({
    role: z.enum(["product", "inspiration", "logo"]),
    productId: z.uuid().nullable(),
    isPrimary: z.boolean(),
});
export const downloadSchema = z.object({ url: z.url(), filename: z.string() });
export const productSchema = z.object({
    id: z.uuid(),
    name: z.string(),
    description: z.string(),
    packaging: z.string(),
    referenceCount: z.number().int(),
    primaryAssetId: z.uuid().nullable(),
});
export const productListSchema = z.array(productSchema);
export const productInputSchema = z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).default(""),
    packaging: z.string().max(2000).default(""),
});
export type Asset = z.infer<typeof assetSchema>;
export type Product = z.infer<typeof productSchema>;
export type UploadInput = z.infer<typeof uploadSchema>;
