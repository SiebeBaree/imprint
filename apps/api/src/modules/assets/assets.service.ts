/* oxlint-disable no-await-in-loop -- Process PDF pages and replacement files sequentially to bound memory and preserve replacement order. */
import { assetSchema, type Asset } from "@repo/contracts";
import type { AssetRow, Database } from "@repo/db";
import sharp from "sharp";

import type { Storage } from "../../lib/dependencies";
import { HttpError, NotFoundError } from "../../lib/errors";
import { brandsRepo } from "../brands/brands.repo";
import { productsRepo } from "../products/products.repo";
import { assetsRepo } from "./assets.repo";

export async function assetResponse(row: AssetRow, storage: Storage): Promise<Asset> {
    return assetSchema.parse({
        ...row,
        url: row.status === "ready" ? await storage.readUrl(row.key) : null,
        createdAt: row.createdAt.toISOString(),
    });
}
export function assetsService(db: Database, storage: Storage) {
    const repo = assetsRepo(db);
    const brandRepo = brandsRepo(db);
    async function owned(owner: string, id: string) {
        const brand = await brandRepo.forOwner(owner);
        const asset = await repo.get(brand.id, id);
        if (!asset || asset.role === "generated") throw new NotFoundError("Reference not found.");
        return { asset, brand };
    }
    return {
        async list(owner: string) {
            const brand = await brandRepo.forOwner(owner);
            return Promise.all((await repo.list(brand.id)).map((row) => assetResponse(row, storage)));
        },
        async upload(owner: string, input: { name: string; mimeType: string; size: number }) {
            const brand = await brandRepo.forOwner(owner);
            if (brand.status === "analyzing")
                throw new HttpError(409, "Wait for brand analysis to finish before uploading.");
            const row = await repo.reserve(brand.id, input);
            try {
                return {
                    asset: await assetResponse(row, storage),
                    uploadUrl: await storage.uploadUrl(row.key, row.mimeType, row.bytes),
                    headers: { "Content-Type": row.mimeType },
                };
            } catch (error) {
                await repo.remove(brand.id, row.id);
                throw error;
            }
        },
        async complete(owner: string, id: string) {
            const { asset, brand } = await owned(owner, id);
            if (asset.status === "ready") return assetResponse(asset, storage);
            if (brand.status === "analyzing") throw new HttpError(409, "Wait for brand analysis to finish.");
            try {
                const metadata = await storage.head(asset.key);
                if (
                    metadata.size !== asset.bytes ||
                    metadata.size > 25 * 1024 * 1024 ||
                    metadata.contentType !== asset.mimeType
                )
                    throw new HttpError(400, "This file does not match the upload. Please upload it again.");
                const bytes = await storage.read(asset.key);
                let update: Partial<AssetRow>;
                if (asset.role === "guidelines") {
                    if (Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-")
                        throw new HttpError(400, "Choose a valid PDF file.");
                    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
                    const loading = getDocument({
                        data: new Uint8Array(bytes),
                        useSystemFonts: false,
                        disableFontFace: true,
                    });
                    const pdf = await loading.promise;
                    try {
                        if (pdf.numPages > 50) throw new HttpError(400, "Use a PDF with no more than 50 pages.");
                        const pages: string[] = [];
                        for (let page = 1; page <= pdf.numPages; page++) {
                            const content = await (await pdf.getPage(page)).getTextContent();
                            pages.push(
                                `Page ${page}: ${content.items.map((item) => ("str" in item ? item.str : "")).join(" ")}`,
                            );
                        }
                        const extractedText = pages.join("\n").slice(0, 120000);
                        if (extractedText.trim().length < 40)
                            throw new HttpError(
                                400,
                                "This PDF has no readable text. Export a PDF with selectable text and try again.",
                            );
                        update = { extractedText };
                    } finally {
                        await loading.destroy();
                    }
                } else {
                    const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" });
                    const info = await image.metadata();
                    const formats: Record<string, string> = {
                        jpeg: "image/jpeg",
                        png: "image/png",
                        webp: "image/webp",
                    };
                    if (
                        !info.format ||
                        formats[info.format] !== asset.mimeType ||
                        !info.width ||
                        !info.height ||
                        info.width < 128 ||
                        info.height < 128
                    )
                        throw new HttpError(400, "Use a JPG, PNG or WebP image at least 128 pixels wide and tall.");
                    // Re-encoding removes location metadata and normalizes rotation before the model sees it.
                    const normalized = await image
                        .rotate()
                        .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
                        .webp({ quality: 92 })
                        .toBuffer({ resolveWithObject: true });
                    const key = `${asset.key}.webp`;
                    await storage.put(key, normalized.data, "image/webp");
                    update = {
                        key,
                        mimeType: "image/webp",
                        bytes: normalized.data.length,
                        width: normalized.info.width,
                        height: normalized.info.height,
                    };
                }
                const row = await repo.update(id, { ...update, status: "ready", error: null });
                if (!row) throw new NotFoundError();
                if (row.key !== asset.key) await storage.remove(asset.key);
                if (asset.role === "guidelines") {
                    for (const old of await repo.list(brand.id)) {
                        if (old.id !== id && old.role === "guidelines" && old.status === "ready") {
                            await storage.remove(old.key);
                            await repo.remove(brand.id, old.id);
                        }
                    }
                }
                await repo.invalidateProfile(brand.id);
                return assetResponse(row, storage);
            } catch (error) {
                await repo.update(id, {
                    status: "failed",
                    error:
                        error instanceof HttpError
                            ? error.message
                            : "The file could not be processed. Try uploading it again.",
                });
                throw error;
            }
        },
        async update(
            owner: string,
            id: string,
            input: { role: "product" | "inspiration" | "logo"; productId: string | null; isPrimary: boolean },
        ) {
            const { brand, asset } = await owned(owner, id);
            if (["instagram", "guidelines"].includes(asset.role))
                throw new HttpError(400, "This reference cannot be reassigned.");
            if (brand.status === "analyzing") throw new HttpError(409, "Wait for brand analysis to finish.");
            if (input.productId && !(await productsRepo(db).get(brand.id, input.productId)))
                throw new NotFoundError("Product not found.");
            const row = await repo.assign(brand.id, id, input);
            if (!row) throw new NotFoundError();
            await repo.invalidateProfile(brand.id);
            return assetResponse(row, storage);
        },
        async remove(owner: string, id: string) {
            const { brand } = await owned(owner, id);
            if (brand.status === "analyzing" || brand.instagramStatus === "importing")
                throw new HttpError(409, "Wait for the current import or analysis to finish.");
            // Existing campaigns retain the original bytes for later edits.
            await repo.remove(brand.id, id);
            await repo.invalidateProfile(brand.id);
        },
    };
}
