import { toast } from "sonner";

import { ApiError } from "./index";

/**
 * The app-wide convention for surfacing a failed api call: the server's safe message, plus a short reference the user
 * can quote to support. The full id is searchable in Axiom and Sentry.
 */
export function toastApiError(error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    const reference = error instanceof ApiError && error.requestId ? ` (ref: ${error.requestId.slice(0, 8)})` : "";
    toast.error(`${message}${reference}`);
}
