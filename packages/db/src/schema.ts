import type { AssetBrief, BrandProfile, CampaignPlan, QualityReport, Suggestion } from "@repo/contracts";
import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
export const brands = pgTable("brands", {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: text().notNull().unique(),
    name: text().notNull().default("Your brand"),
    instagramUrl: text(),
    instagramStatus: text()
        .$type<"missing" | "queued" | "importing" | "ready" | "partial" | "failed">()
        .notNull()
        .default("missing"),
    instagramMessage: text(),
    instagramCount: integer().notNull().default(0),
    instagramRunId: text(),
    status: text().$type<"collecting" | "analyzing" | "review" | "ready" | "failed">().notNull().default("collecting"),
    profile: jsonb().$type<BrandProfile>(),
    profileVersion: integer().notNull().default(0),
    profileConfirmedAt: timestamp({ withTimezone: true }),
    suggestions: jsonb().$type<Suggestion[]>().notNull().default([]),
    suggestionsStatus: text().$type<"missing" | "queued" | "ready" | "failed">().notNull().default("missing"),
    imageCount: integer().notNull().default(0),
    error: text(),
    createdAt: createdAt(),
});
export const products = pgTable("products", {
    id: uuid().primaryKey().defaultRandom(),
    brandId: uuid()
        .notNull()
        .references(() => brands.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text().notNull().default(""),
    packaging: text().notNull().default(""),
    createdAt: createdAt(),
});
export const assets = pgTable("assets", {
    id: uuid().primaryKey().defaultRandom(),
    brandId: uuid()
        .notNull()
        .references(() => brands.id, { onDelete: "cascade" }),
    name: text().notNull(),
    key: text().notNull().unique(),
    mimeType: text().notNull(),
    bytes: integer().notNull(),
    role: text().$type<"product" | "inspiration" | "logo" | "guidelines" | "instagram" | "generated">().notNull(),
    status: text().$type<"uploading" | "processing" | "ready" | "failed">().notNull().default("uploading"),
    width: integer(),
    height: integer(),
    productId: uuid().references(() => products.id, { onDelete: "set null" }),
    isPrimary: boolean().notNull().default(false),
    caption: text(),
    sourceUrl: text(),
    sourceId: text(),
    extractedText: text(),
    error: text(),
    deletedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
});
export const brandProfiles = pgTable(
    "brand_profiles",
    {
        id: uuid().primaryKey().defaultRandom(),
        brandId: uuid()
            .notNull()
            .references(() => brands.id, { onDelete: "cascade" }),
        version: integer().notNull(),
        profile: jsonb().$type<BrandProfile>().notNull(),
        createdAt: createdAt(),
    },
    (table) => [uniqueIndex("brand_profiles_version").on(table.brandId, table.version)],
);
export const campaigns = pgTable(
    "campaigns",
    {
        id: uuid().primaryKey().defaultRandom(),
        brandId: uuid()
            .notNull()
            .references(() => brands.id, { onDelete: "cascade" }),
        requestKey: text().notNull(),
        title: text().notNull().default("New campaign"),
        brief: text().notNull(),
        productId: uuid()
            .notNull()
            .references(() => products.id),
        supportingProductIds: jsonb().$type<string[]>().notNull().default([]),
        profileVersion: integer().notNull(),
        profileSnapshot: jsonb().$type<BrandProfile>().notNull(),
        referenceSnapshot: jsonb()
            .$type<{ id: string; productId: string | null; isPrimary: boolean }[]>()
            .notNull()
            .default([]),
        productSnapshot: jsonb()
            .$type<{ id: string; name: string; description: string; packaging: string }[]>()
            .notNull()
            .default([]),
        startDate: text().notNull(),
        durationDays: integer().notNull().default(14),
        status: text()
            .$type<"queued" | "planning" | "generating" | "checking" | "ready" | "needs_attention" | "failed">()
            .notNull()
            .default("queued"),
        stage: text().notNull().default("Waiting to start"),
        plan: jsonb().$type<CampaignPlan>(),
        error: text(),
        createdAt: createdAt(),
    },
    (table) => [uniqueIndex("campaigns_request").on(table.brandId, table.requestKey)],
);
export const campaignItems = pgTable(
    "campaign_items",
    {
        id: uuid().primaryKey().defaultRandom(),
        campaignId: uuid()
            .notNull()
            .references(() => campaigns.id, { onDelete: "cascade" }),
        sequence: integer().notNull(),
        brief: jsonb().$type<AssetBrief>().notNull(),
        caption: text().notNull(),
        publishDate: text().notNull(),
        publishTime: text().notNull(),
        status: text()
            .$type<"queued" | "generating" | "checking" | "ready" | "needs_attention" | "failed">()
            .notNull()
            .default("queued"),
        currentVersionId: uuid(),
        revision: integer().notNull().default(0),
    },
    (table) => [uniqueIndex("campaign_item_sequence").on(table.campaignId, table.sequence)],
);
export const imageVersions = pgTable(
    "image_versions",
    {
        id: uuid().primaryKey().defaultRandom(),
        itemId: uuid()
            .notNull()
            .references(() => campaignItems.id, { onDelete: "cascade" }),
        parentId: uuid(),
        number: integer().notNull(),
        assetId: uuid().references(() => assets.id, { onDelete: "set null" }),
        prompt: text(),
        status: text()
            .$type<"queued" | "generating" | "checking" | "ready" | "needs_attention" | "failed">()
            .notNull()
            .default("queued"),
        quality: jsonb().$type<QualityReport>(),
        error: text(),
        createdAt: createdAt(),
    },
    (table) => [uniqueIndex("image_version_number").on(table.itemId, table.number)],
);
export const jobs = pgTable("jobs", {
    id: uuid().primaryKey().defaultRandom(),
    brandId: uuid()
        .notNull()
        .references(() => brands.id, { onDelete: "cascade" }),
    kind: text().$type<"instagram" | "analysis" | "campaign" | "edit" | "recommendations">().notNull(),
    entityId: uuid().notNull(),
    status: text().$type<"queued" | "running" | "complete" | "failed">().notNull().default("queued"),
    stage: text().notNull().default("Waiting to start"),
    error: text(),
    runId: text(),
    attempts: integer().notNull().default(0),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
});
export const generationAttempts = pgTable("generation_attempts", {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
        .notNull()
        .references(() => jobs.id, { onDelete: "cascade" }),
    operation: text().notNull(),
    model: text().notNull(),
    providerRequestId: text(),
    usage: jsonb().$type<Record<string, unknown>>(),
    durationMs: integer().notNull(),
    createdAt: createdAt(),
});
export type BrandRow = typeof brands.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type CampaignRow = typeof campaigns.$inferSelect;
export type ItemRow = typeof campaignItems.$inferSelect;
export type VersionRow = typeof imageVersions.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
