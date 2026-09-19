import { zodResolver } from "@hookform/resolvers/zod";
import { createTodoSchema, type CreateTodoInput } from "@repo/contracts";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { toastApiError } from "@/lib/api-client/toast";

import { useCreateTodo } from "../api";

export function TodoForm() {
    const form = useForm<CreateTodoInput>({
        resolver: zodResolver(createTodoSchema),
        defaultValues: { title: "" },
    });
    const create = useCreateTodo();

    const onSubmit = form.handleSubmit((input) =>
        create.mutate(input, {
            onSuccess: () => form.reset(),
            onError: (error) => {
                const titleIssue =
                    error instanceof ApiError ? error.issues?.find((issue) => issue.path === "title") : undefined;
                if (titleIssue) {
                    form.setError("title", { message: titleIssue.message });
                    return;
                }
                toastApiError(error);
            },
        }),
    );

    const titleError = form.formState.errors.title?.message;

    return (
        <form onSubmit={onSubmit} noValidate>
            <div className="flex gap-2">
                <Input
                    {...form.register("title")}
                    placeholder="What needs doing?"
                    aria-label="New todo title"
                    aria-invalid={titleError ? true : undefined}
                    autoComplete="off"
                />
                <Button type="submit" disabled={create.isPending}>
                    <Plus data-icon="inline-start" />
                    Add
                </Button>
            </div>
            {titleError ? (
                <p role="alert" className="mt-2 text-sm text-destructive">
                    {titleError}
                </p>
            ) : null}
        </form>
    );
}
