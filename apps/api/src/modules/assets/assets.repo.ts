import { randomUUID } from "node:crypto";

import { assets, brands, type Database } from "@repo/db";
import { and, desc, eq, ne, sql, isNull } from "drizzle-orm";

import { HttpError } from "../../lib/errors";

export function assetsRepo(db: Database) {
    return {
        list: (brandId: string) =>
            db
                .select()
                .from(assets)
                .where(and(eq(assets.brandId, brandId), ne(assets.role, "generated"), isNull(assets.deletedAt)))
                .orderBy(desc(assets.createdAt)),
        async get(brandId: string, id: string) {
            return (
                await db
                    .select()
                    .from(assets)
                    .where(and(eq(assets.brandId, brandId), eq(assets.id, id), isNull(assets.deletedAt)))
            )[0];
        },
        async reserve(brandId: string, input: { name: string; mimeType: string; size: number }) {
            const id = randomUUID();
            const role = input.mimeType === "application/pdf" ? "guidelines" : "product";
            const key = `${brandId}/references/${id}`;
            // The counter and reservation are one statement so concurrent uploads cannot exceed the limit.
            await db.execute(sql`WITH reserved AS (
                UPDATE brands SET image_count = image_count + ${role === "guidelines" ? 0 : 1}
                WHERE id = ${brandId} AND (${role === "guidelines"} OR image_count < 50) RETURNING id
            ) INSERT INTO assets (id, brand_id, name, key, mime_type, bytes, role)
            SELECT ${id}, id, ${input.name}, ${key}, ${input.mimeType}, ${input.size}, ${role} FROM reserved`);
            const row = (await db.select().from(assets).where(eq(assets.id, id)))[0];
            if (!row)
                throw new HttpError(409, "You can upload up to 50 reference images. Remove one before adding another.");
            return row;
        },
        async update(id: string, data: Partial<typeof assets.$inferInsert>) {
            return (await db.update(assets).set(data).where(eq(assets.id, id)).returning())[0];
        },
        async assign(
            brandId: string,
            id: string,
            input: { role: "product" | "inspiration" | "logo"; productId: string | null; isPrimary: boolean },
        ) {
            const productId = input.role === "product" ? input.productId : null;
            const isPrimary = Boolean(productId && input.isPrimary);
            // One update locks the reference set and replaces the previous primary photo atomically.
            const rows = await db
                .update(assets)
                .set({
                    role: sql`CASE WHEN ${assets.id} = ${id} THEN ${input.role} ELSE ${assets.role} END`,
                    productId: sql`CASE WHEN ${assets.id} = ${id} THEN ${productId}::uuid ELSE ${assets.productId} END`,
                    isPrimary: sql`CASE WHEN ${assets.id} = ${id} THEN ${isPrimary} WHEN ${isPrimary} AND ${assets.productId} = ${productId}::uuid THEN FALSE ELSE ${assets.isPrimary} END`,
                })
                .where(
                    and(
                        eq(assets.brandId, brandId),
                        isNull(assets.deletedAt),
                        sql`${assets.role} IN ('product', 'inspiration', 'logo')`,
                    ),
                )
                .returning();
            return rows.find((row) => row.id === id);
        },
        async remove(brandId: string, id: string) {
            await db.execute(sql`WITH deleted AS (UPDATE assets SET deleted_at = NOW() WHERE id = ${id} AND brand_id = ${brandId} AND deleted_at IS NULL RETURNING role)
                UPDATE brands SET image_count = GREATEST(0, image_count - (SELECT COUNT(*) FROM deleted WHERE role IN ('product','inspiration','logo'))::integer) WHERE id = ${brandId}`);
        },
        async invalidateProfile(brandId: string) {
            await db
                .update(brands)
                .set({ profileConfirmedAt: null, status: "collecting", suggestions: [] })
                .where(eq(brands.id, brandId));
        },
    };
}
