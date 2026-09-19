import { buildApp } from "../app";
import { createTestDb } from "./db";

export async function buildTestApp() {
    const { db, reset, close } = await createTestDb();
    const app = await buildApp({ db, corsOrigin: "http://localhost:5173" });
    await app.ready();

    return {
        app,
        reset,
        close: async () => {
            await app.close();
            await close();
        },
    };
}
