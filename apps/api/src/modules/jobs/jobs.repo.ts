import { jobs, type Database } from "@repo/db";
import { and, desc, eq, inArray, lt, isNotNull } from "drizzle-orm";
export function jobsRepo(db: Database) {
    return {
        async stale(brandId: string) {
            return db
                .select()
                .from(jobs)
                .where(
                    and(
                        eq(jobs.brandId, brandId),
                        inArray(jobs.status, ["queued", "running"]),
                        isNotNull(jobs.runId),
                        lt(jobs.updatedAt, new Date(Date.now() - 30_000)),
                    ),
                );
        },
        async get(id: string) {
            return (await db.select().from(jobs).where(eq(jobs.id, id)))[0];
        },
        async latest(brandId: string, entityId: string) {
            return (
                await db
                    .select()
                    .from(jobs)
                    .where(and(eq(jobs.brandId, brandId), eq(jobs.entityId, entityId)))
                    .orderBy(desc(jobs.createdAt))
                    .limit(1)
            )[0];
        },
        async active(brandId: string) {
            return (
                await db
                    .select()
                    .from(jobs)
                    .where(and(eq(jobs.brandId, brandId), inArray(jobs.status, ["queued", "running"])))
                    .orderBy(desc(jobs.createdAt))
                    .limit(1)
            )[0];
        },
        async create(brandId: string, kind: typeof jobs.$inferInsert.kind, entityId: string) {
            const row = (await db.insert(jobs).values({ brandId, kind, entityId }).returning())[0];
            if (!row) throw new Error("Job insert returned no row.");
            return row;
        },
        async update(id: string, data: Partial<typeof jobs.$inferInsert>) {
            return (
                await db
                    .update(jobs)
                    .set({ ...data, updatedAt: new Date() })
                    .where(eq(jobs.id, id))
                    .returning()
            )[0];
        },
    };
}
