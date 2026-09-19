import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

export function createDb(connectionString: string) {
    return drizzle(neon(connectionString), { schema, casing: "snake_case" });
}

// The api is written against this interface so tests can swap in a PGlite-backed drizzle instance.
export type Database = ReturnType<typeof createDb>;

export * from "./schema";
export { schema };
