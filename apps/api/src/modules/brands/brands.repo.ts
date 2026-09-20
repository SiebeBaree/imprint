import type { BrandProfile } from "@repo/contracts";
import { brandProfiles, brands, assets, type Database } from "@repo/db";
import { and, eq, ne, sql, isNull } from "drizzle-orm";

export function brandsRepo(db: Database) {
    return {
        async forOwner(ownerId: string) {
            await db.insert(brands).values({ ownerId }).onConflictDoNothing({ target: brands.ownerId });
            const [row] = await db.select().from(brands).where(eq(brands.ownerId, ownerId));
            if (!row) throw new Error("Brand initialization failed");
            return row;
        },
        async byId(id: string) {
            return (await db.select().from(brands).where(eq(brands.id, id)))[0];
        },
        async update(id: string, values: Partial<typeof brands.$inferInsert>) {
            return (await db.update(brands).set(values).where(eq(brands.id, id)).returning())[0];
        },
        readyAssets: (brandId: string) =>
            db
                .select()
                .from(assets)
                .where(and(eq(assets.brandId, brandId), eq(assets.status, "ready"), isNull(assets.deletedAt))),
        async claimRecommendations(id: string) {
            return (
                await db
                    .update(brands)
                    .set({ suggestionsStatus: "queued" })
                    .where(and(eq(brands.id, id), ne(brands.suggestionsStatus, "queued")))
                    .returning()
            )[0];
        },
        async claimAnalysis(id: string) {
            return (
                await db
                    .update(brands)
                    .set({ status: "analyzing", error: null, profileConfirmedAt: null })
                    .where(and(eq(brands.id, id), ne(brands.status, "analyzing")))
                    .returning()
            )[0];
        },
        async claimInstagram(id: string, url: string) {
            return (
                await db
                    .update(brands)
                    .set({
                        instagramUrl: url,
                        instagramStatus: "queued",
                        instagramRunId: null,
                        instagramMessage: null,
                        profileConfirmedAt: null,
                        status: "collecting",
                        suggestions: [],
                        suggestionsStatus: "missing",
                    })
                    .where(
                        and(
                            eq(brands.id, id),
                            ne(brands.instagramStatus, "queued"),
                            ne(brands.instagramStatus, "importing"),
                            ne(brands.status, "analyzing"),
                        ),
                    )
                    .returning()
            )[0];
        },
        async updateProfile(id: string, version: number, profile: BrandProfile) {
            return (
                await db
                    .update(brands)
                    .set({
                        profile,
                        profileVersion: sql`${brands.profileVersion} + 1`,
                        profileConfirmedAt: null,
                        suggestions: [],
                        suggestionsStatus: "missing",
                        status: "review",
                    })
                    .where(and(eq(brands.id, id), eq(brands.profileVersion, version)))
                    .returning()
            )[0];
        },
        async confirm(id: string, version: number, profile: BrandProfile) {
            await db.insert(brandProfiles).values({ brandId: id, version, profile }).onConflictDoNothing();
            return (
                await db
                    .update(brands)
                    .set({ profileConfirmedAt: new Date(), status: "ready" })
                    .where(and(eq(brands.id, id), eq(brands.profileVersion, version)))
                    .returning()
            )[0];
        },
    };
}
