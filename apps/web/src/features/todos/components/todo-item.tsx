import type { Todo } from "@repo/contracts";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, formatRelativeTime } from "@/lib/utils";

export function TodoItem({
    todo,
    onToggle,
    onDelete,
}: {
    todo: Todo;
    onToggle: (completed: boolean) => void;
    onDelete: () => void;
}) {
    return (
        <li className="group flex items-center gap-3 py-3">
            <Checkbox
                checked={todo.completed}
                onCheckedChange={(checked) => onToggle(checked === true)}
                aria-label={`Mark "${todo.title}" as ${todo.completed ? "not done" : "done"}`}
            />
            <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm", todo.completed && "text-muted-foreground line-through")}>
                    {todo.title}
                </p>
                <p className="text-xs text-muted-foreground">{formatRelativeTime(new Date(todo.createdAt))}</p>
            </div>
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={onDelete}
                aria-label={`Delete "${todo.title}"`}
                className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
                <Trash2 />
            </Button>
        </li>
    );
}
