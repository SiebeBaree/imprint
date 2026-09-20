import { buildApp } from "../app";
import { createTestDb } from "./db";
import { createTestServices } from "./services";

export async function buildTestApp() {
    const { db, reset, close } = await createTestDb();
    const services = createTestServices();
    const app = await buildApp({ db, services, corsOrigin: "http://localhost:5173" });
    await app.ready();

    return {
        app,
        db,
        services,
        reset,
        close: async () => {
            await app.close();
            await close();
        },
    };
}
