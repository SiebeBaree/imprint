import { TodoList } from "@/features/todos";

export function meta() {
    return [{ title: "Your todos · Todos" }];
}

export default function TodosPage() {
    return (
        <main className="mx-auto max-w-md px-6 py-16">
            <TodoList />
        </main>
    );
}
