import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toastApiError } from "@/lib/api-client/toast";

import { useDeleteTodo, useTodos, useToggleTodo } from "../api";
import { TodoForm } from "./todo-form";
import { TodoItem } from "./todo-item";

export function TodoList() {
    const todosQuery = useTodos();
    const toggle = useToggleTodo();
    const remove = useDeleteTodo();

    if (todosQuery.isPending) return <TodoListSkeleton />;
    if (todosQuery.isError) {
        return (
            <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                    Could not load todos. Is the api running?
                </CardContent>
            </Card>
        );
    }

    const todos = todosQuery.data;
    const remaining = todos.filter((todo) => !todo.completed).length;

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    Todos
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {remaining} of {todos.length} left
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <TodoForm />
                {todos.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        Nothing here yet. Add your first todo.
                    </p>
                ) : (
                    <ul className="divide-y">
                        {todos.map((todo) => (
                            <TodoItem
                                key={todo.id}
                                todo={todo}
                                onToggle={(completed) =>
                                    toggle.mutate({ id: todo.id, completed }, { onError: toastApiError })
                                }
                                onDelete={() => remove.mutate({ id: todo.id }, { onError: toastApiError })}
                            />
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}

function TodoListSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
                <Skeleton className="h-9 w-full" />
                <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </CardContent>
        </Card>
    );
}
