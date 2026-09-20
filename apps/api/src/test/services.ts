import type { Dependencies } from "../lib/dependencies";
export function createTestServices(): Dependencies & {
    objects: Map<string, { bytes: Uint8Array; contentType: string }>;
} {
    const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
    return {
        objects,
        authenticate: async (token) => {
            if (!token.startsWith("test-")) throw new Error("Invalid session");
            return token;
        },
        dispatch: async (job) => `test-run-${job.id}`,
        runFailure: async () => null,
        storage: {
            uploadUrl: async (key) => `https://storage.example.test/${key}`,
            readUrl: async (key) => `https://storage.example.test/${key}`,
            async read(key) {
                const object = objects.get(key);
                if (!object) throw new Error("Object not found");
                return object.bytes;
            },
            async put(key, bytes, contentType) {
                objects.set(key, { bytes, contentType });
            },
            async remove(key) {
                objects.delete(key);
            },
            async head(key) {
                const object = objects.get(key);
                if (!object) throw new Error("Object not found");
                return { size: object.bytes.length, contentType: object.contentType };
            },
        },
    };
}
