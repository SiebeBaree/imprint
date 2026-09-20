import { assets, products, type Database } from "@repo/db";
import { and, eq, isNull } from "drizzle-orm";

export function productsRepo(db: Database) {
    return {
        list: (brandId: string) => db.select().from(products).where(eq(products.brandId, brandId)),
        async get(brandId: string, id: string) {
            return (
                await db
                    .select()
                    .from(products)
                    .where(and(eq(products.brandId, brandId), eq(products.id, id)))
            )[0];
        },
        async create(brandId: string, input: { name: string; description: string; packaging: string }) {
            return (
                await db
                    .insert(products)
                    .values({ brandId, ...input })
                    .returning()
            )[0];
        },
        async update(brandId: string, id: string, input: { name: string; description: string; packaging: string }) {
            return (
                await db
                    .update(products)
                    .set(input)
                    .where(and(eq(products.brandId, brandId), eq(products.id, id)))
                    .returning()
            )[0];
        },
        references: (brandId: string) =>
            db
                .select()
                .from(assets)
                .where(
                    and(
                        eq(assets.brandId, brandId),
                        eq(assets.status, "ready"),
                        eq(assets.role, "product"),
                        isNull(assets.deletedAt),
                    ),
                ),
    };
}
