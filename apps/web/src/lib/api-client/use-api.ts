import { useCallback } from "react";
import type { z } from "zod";

import { useSession } from "@/features/auth/auth-context";

import { apiFetch } from ".";
export function useApi() {
    const { getToken } = useSession();
    return useCallback(
        async <Schema extends z.ZodType>(path: string, schema: Schema, init?: RequestInit) => {
            const token = await getToken();
            return apiFetch(path, schema, {
                ...init,
                headers: { ...init?.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            });
        },
        [getToken],
    );
}
