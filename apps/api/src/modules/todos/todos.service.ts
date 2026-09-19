import type { Todo } from "@repo/contracts";
import type { Database, TodoRow } from "@repo/db";

import { NotFoundError } from "../../lib/errors";
import { todosRepo } from "./todos.repo";

// Maps rows to the wire format from @repo/contracts and owns the not-found semantics. Input validation already
// happened at the route boundary.
export function todosService(db: Database) {
    const repo = todosRepo(db);

    return {
        async list(): Promise<Todo[]> {
            return (await repo.list()).map(toDto);
        },
        async create(title: string): Promise<Todo> {
            return toDto(await repo.create(title));
        },
        async setCompleted(id: string, completed: boolean): Promise<Todo> {
            const row = await repo.setCompleted(id, completed);
            if (!row) throw new NotFoundError(`Todo ${id} not found`);
            return toDto(row);
        },
        remove(id: string): Promise<void> {
            return repo.remove(id);
        },
    };
}

function toDto(row: TodoRow): Todo {
    return { ...row, createdAt: row.createdAt.toISOString() };
}
