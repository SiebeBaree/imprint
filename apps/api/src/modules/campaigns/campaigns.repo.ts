import { campaigns, campaignItems, imageVersions, assets, type Database } from "@repo/db";
import { and, asc, desc, eq } from "drizzle-orm";
export function campaignsRepo(db: Database) {
    return {
        list: (brandId: string) =>
            db.select().from(campaigns).where(eq(campaigns.brandId, brandId)).orderBy(desc(campaigns.createdAt)),
        async get(brandId: string, id: string) {
            return (
                await db
                    .select()
                    .from(campaigns)
                    .where(and(eq(campaigns.brandId, brandId), eq(campaigns.id, id)))
            )[0];
        },
        async byId(id: string) {
            return (await db.select().from(campaigns).where(eq(campaigns.id, id)))[0];
        },
        async create(data: typeof campaigns.$inferInsert) {
            await db
                .insert(campaigns)
                .values(data)
                .onConflictDoNothing({ target: [campaigns.brandId, campaigns.requestKey] });
            const row = (
                await db
                    .select()
                    .from(campaigns)
                    .where(and(eq(campaigns.brandId, data.brandId), eq(campaigns.requestKey, data.requestKey)))
            )[0];
            if (!row) throw new Error("Campaign insert returned no row.");
            return row;
        },
        async update(id: string, data: Partial<typeof campaigns.$inferInsert>) {
            return (await db.update(campaigns).set(data).where(eq(campaigns.id, id)).returning())[0];
        },
        items: (id: string) =>
            db
                .select()
                .from(campaignItems)
                .where(eq(campaignItems.campaignId, id))
                .orderBy(asc(campaignItems.sequence)),
        async item(id: string, itemId: string) {
            return (
                await db
                    .select()
                    .from(campaignItems)
                    .where(and(eq(campaignItems.campaignId, id), eq(campaignItems.id, itemId)))
            )[0];
        },
        versions: (itemId: string) =>
            db
                .select({ version: imageVersions, asset: assets })
                .from(imageVersions)
                .leftJoin(assets, eq(imageVersions.assetId, assets.id))
                .where(eq(imageVersions.itemId, itemId))
                .orderBy(desc(imageVersions.number)),
        async version(id: string) {
            return (await db.select().from(imageVersions).where(eq(imageVersions.id, id)))[0];
        },
    };
}
