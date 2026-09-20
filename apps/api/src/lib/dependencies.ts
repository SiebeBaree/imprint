import type { JobRow } from "@repo/db";

export type Storage = {
    uploadUrl(key: string, contentType: string, size: number): Promise<string>;
    readUrl(key: string, filename?: string): Promise<string>;
    read(key: string): Promise<Uint8Array>;
    put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
    remove(key: string): Promise<void>;
    head(key: string): Promise<{ size: number; contentType: string }>;
};
export type Dependencies = {
    authenticate(token: string): Promise<string>;
    storage: Storage;
    dispatch(job: JobRow): Promise<string>;
    runFailure(runId: string): Promise<string | null>;
};
