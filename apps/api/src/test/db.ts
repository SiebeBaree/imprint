import { PGlite } from "@electric-sql/pglite";
import { schema, brands, type Database } from "@repo/db";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

// A real in-memory Postgres with the real migrations applied, so integration tests exercise actual SQL without Neon.
export async function createTestDb() {
    const client = new PGlite();
    const db = drizzle(client, { schema, casing: "snake_case" });
    await migrate(db, { migrationsFolder: new URL("../../../../packages/db/migrations", import.meta.url).pathname });

    return {
        db: db as unknown as Database,
        reset: async () => {
            await db.delete(brands);
        },
        close: () => client.close(),
    };
}
