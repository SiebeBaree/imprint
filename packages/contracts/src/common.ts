import { z } from "zod";

// Every non-2xx response has this shape. requestId is the reference a user can quote to support; issues carries
// field-level validation errors for 400s.
export const errorSchema = z.object({
    message: z.string(),
    requestId: z.string().optional(),
    issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

export type ApiErrorBody = z.infer<typeof errorSchema>;
