import { todoListSchema, todoSchema, type CreateTodoInput, type Todo } from "@repo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { track } from "@/lib/analytics";
import { apiFetch } from "@/lib/api-client";

import { todoKeys } from "./keys";

export function useTodos() {
    return useQuery({
        queryKey: todoKeys.list,
        queryFn: () => apiFetch("/todos", todoListSchema),
    });
}

export function useCreateTodo() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateTodoInput) =>
            apiFetch("/todos", todoSchema, { method: "POST", body: JSON.stringify(input) }),
        onSuccess: (_todo, input) => {
            track("todo_created", { title_length: input.title.length });
            void queryClient.invalidateQueries({ queryKey: todoKeys.list });
        },
    });
}

// Both mutations below are optimistic: apply locally, roll back on error, reconcile with a refetch on settle.

export function useToggleTodo() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
            apiFetch(`/todos/${id}`, todoSchema, { method: "PATCH", body: JSON.stringify({ completed }) }),
        onMutate: async ({ id, completed }) => {
            await queryClient.cancelQueries({ queryKey: todoKeys.list });
            const previous = queryClient.getQueryData<Todo[]>(todoKeys.list);
            queryClient.setQueryData<Todo[]>(todoKeys.list, (current) =>
                current?.map((todo) => (todo.id === id ? { ...todo, completed } : todo)),
            );
            return { previous };
        },
        onSuccess: (_todo, { completed }) => track(completed ? "todo_completed" : "todo_reopened"),
        onError: (_error, _input, context) => queryClient.setQueryData(todoKeys.list, context?.previous),
        onSettled: () => queryClient.invalidateQueries({ queryKey: todoKeys.list }),
    });
}

export function useDeleteTodo() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id }: { id: string }) => apiFetch(`/todos/${id}`, z.undefined(), { method: "DELETE" }),
        onMutate: async ({ id }) => {
            await queryClient.cancelQueries({ queryKey: todoKeys.list });
            const previous = queryClient.getQueryData<Todo[]>(todoKeys.list);
            queryClient.setQueryData<Todo[]>(todoKeys.list, (current) => current?.filter((todo) => todo.id !== id));
            return { previous, wasCompleted: previous?.find((todo) => todo.id === id)?.completed ?? false };
        },
        onSuccess: (_data, _input, context) => track("todo_deleted", { was_completed: context.wasCompleted }),
        onError: (_error, _input, context) => queryClient.setQueryData(todoKeys.list, context?.previous),
        onSettled: () => queryClient.invalidateQueries({ queryKey: todoKeys.list }),
    });
}
