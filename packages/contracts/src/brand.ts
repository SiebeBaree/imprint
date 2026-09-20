import { z } from "zod";

export const idParamsSchema = z.object({ id: z.uuid() });
export const instagramUrlSchema = z
    .string()
    .trim()
    .transform((value, ctx) => {
        try {
            const url = new URL(value);
            const parts = url.pathname.split("/").filter(Boolean);
            const username = parts[0] ?? "";
            if (
                !["instagram.com", "www.instagram.com"].includes(url.hostname) ||
                url.protocol !== "https:" ||
                url.username ||
                url.password ||
                url.port ||
                parts.length !== 1 ||
                !/^[a-zA-Z0-9._]{1,30}$/.test(username) ||
                ["p", "reel", "reels", "stories", "explore", "accounts"].includes(username.toLowerCase())
            )
                throw new Error("Invalid profile");
            return `https://www.instagram.com/${username}/`;
        } catch {
            ctx.addIssue({
                code: "custom",
                message: "Enter an Instagram profile URL, like https://www.instagram.com/yourbrand/.",
            });
            return z.NEVER;
        }
    });

export const evidenceSchema = z.object({ sourceId: z.string(), detail: z.string() });
export const brandFieldSchema = z.object({
    value: z.string().max(4000),
    evidence: z.array(evidenceSchema),
    confirmed: z.boolean(),
});
export const profileSchema = z.object({
    positioning: brandFieldSchema,
    audience: brandFieldSchema,
    voice: brandFieldSchema,
    photography: brandFieldSchema,
    colors: z
        .array(
            z.object({
                name: z.string(),
                hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
                evidence: z.array(evidenceSchema),
            }),
        )
        .max(8),
    fonts: brandFieldSchema,
    productRules: brandFieldSchema,
    approvedClaims: z.array(z.object({ claim: z.string(), evidence: z.array(evidenceSchema).min(1) })).max(30),
    avoid: z.array(z.string()).max(30),
    questions: z.array(z.string()).max(8),
});
export const suggestionSchema = z.object({ title: z.string(), brief: z.string(), productId: z.uuid() });
export const brandSchema = z.object({
    id: z.uuid(),
    name: z.string(),
    instagramUrl: z.string().nullable(),
    instagramStatus: z.enum(["missing", "queued", "importing", "ready", "partial", "failed"]),
    instagramMessage: z.string().nullable(),
    instagramCount: z.number().int(),
    status: z.enum(["collecting", "analyzing", "review", "ready", "failed"]),
    profile: profileSchema.nullable(),
    profileVersion: z.number().int(),
    profileConfirmedAt: z.iso.datetime().nullable(),
    suggestions: z.array(suggestionSchema),
    suggestionsStatus: z.enum(["missing", "queued", "ready", "failed"]),
    error: z.string().nullable(),
    createdAt: z.iso.datetime(),
});
export const updateBrandSchema = z.object({ name: z.string().trim().min(1).max(100) });
export const importInstagramSchema = z.object({ url: instagramUrlSchema });
export const updateProfileSchema = z.object({ profile: profileSchema, version: z.number().int().nonnegative() });
export const confirmProfileSchema = z.object({ version: z.number().int().positive() });
export type Brand = z.infer<typeof brandSchema>;
export type BrandProfile = z.infer<typeof profileSchema>;
export type BrandField = z.infer<typeof brandFieldSchema>;
export type Suggestion = z.infer<typeof suggestionSchema>;
