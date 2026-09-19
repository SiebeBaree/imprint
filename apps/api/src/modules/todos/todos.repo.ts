import { todos, type Database, type TodoRow } from "@repo/db";
import { desc, eq } from "drizzle-orm";

export function todosRepo(db: Database) {
    return {
        list(): Promise<TodoRow[]> {
            return db.select().from(todos).orderBy(desc(todos.createdAt));
        },
        async create(title: string): Promise<TodoRow> {
            const [row] = await db.insert(todos).values({ title }).returning();
            if (!row) throw new Error("insert returned no row");
            return row;
        },
        async setCompleted(id: string, completed: boolean): Promise<TodoRow | null> {
            const [row] = await db.update(todos).set({ completed }).where(eq(todos.id, id)).returning();
            return row ?? null;
        },
        async remove(id: string): Promise<void> {
            await db.delete(todos).where(eq(todos.id, id));
        },
    };
}
