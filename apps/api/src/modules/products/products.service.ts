import type { ProductRow, Database } from "@repo/db";

import { NotFoundError } from "../../lib/errors";
import { brandsRepo } from "../brands/brands.repo";
import { productsRepo } from "./products.repo";

export function productsService(db: Database) {
    const repo = productsRepo(db);
    async function response(brandId: string, product: ProductRow) {
        const refs = (await repo.references(brandId)).filter((asset) => asset.productId === product.id);
        return {
            id: product.id,
            name: product.name,
            description: product.description,
            packaging: product.packaging,
            referenceCount: refs.length,
            primaryAssetId: refs.find((asset) => asset.isPrimary)?.id ?? refs[0]?.id ?? null,
        };
    }
    return {
        async list(owner: string) {
            const brand = await brandsRepo(db).forOwner(owner);
            return Promise.all((await repo.list(brand.id)).map((product) => response(brand.id, product)));
        },
        async save(owner: string, input: { name: string; description: string; packaging: string }, id?: string) {
            const brand = await brandsRepo(db).forOwner(owner);
            const product = id ? await repo.update(brand.id, id, input) : await repo.create(brand.id, input);
            if (!product) throw new NotFoundError("Product not found.");
            return response(brand.id, product);
        },
    };
}
