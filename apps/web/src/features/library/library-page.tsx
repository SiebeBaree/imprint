import type { Asset, Product } from "@repo/contracts";
import { Check, FileText, Image, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { ErrorMessage, Field, Loading, Modal, PageHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBrandActions, useProducts } from "@/features/brand/api";

import { useAssetActions, useAssets } from "./api";
import { UploadZone } from "./upload-zone";
function AssetDetails({ asset, products, close }: { asset: Asset; products: Product[]; close: () => void }) {
    const actions = useAssetActions();
    const [role, setRole] = useState<"product" | "inspiration" | "logo">(
        asset.role === "logo" || asset.role === "inspiration" ? asset.role : "product",
    );
    const [productId, setProductId] = useState(asset.productId ?? "");
    const [primary, setPrimary] = useState(asset.isPrimary);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const mutable = !["instagram", "guidelines"].includes(asset.role);
    return (
        <div className="asset-inspector">
            <div className="asset-inspector-image">
                {asset.url && asset.mimeType.startsWith("image/") ? (
                    <img src={asset.url} alt={asset.name} />
                ) : (
                    <FileText size={60} />
                )}
            </div>
            <div className="asset-inspector-controls">
                <p className="muted small">{asset.width ? `${asset.width} × ${asset.height} px` : "PDF document"}</p>
                {mutable && (
                    <>
                        <Field label="Use this image as" htmlFor="asset-role">
                            <select
                                id="asset-role"
                                value={role}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    if (value === "product" || value === "inspiration" || value === "logo")
                                        setRole(value);
                                }}
                            >
                                <option value="product">Product reference</option>
                                <option value="inspiration">Style reference</option>
                                <option value="logo">Logo</option>
                            </select>
                        </Field>
                        {role === "product" && (
                            <>
                                <Field label="Product" htmlFor="asset-product">
                                    <select
                                        id="asset-product"
                                        value={productId}
                                        onChange={(event) => setProductId(event.target.value)}
                                    >
                                        <option value="">Not assigned yet</option>
                                        {products.map((product) => (
                                            <option key={product.id} value={product.id}>
                                                {product.name}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={primary}
                                        onChange={(event) => setPrimary(event.target.checked)}
                                    />
                                    Use as primary reference
                                </label>
                            </>
                        )}
                        <Button
                            disabled={actions.update.isPending}
                            onClick={async () => {
                                try {
                                    await actions.update.mutateAsync({
                                        id: asset.id,
                                        role,
                                        productId: productId || null,
                                        isPrimary: primary,
                                    });
                                    close();
                                } catch {
                                    /* Shown below. */
                                }
                            }}
                        >
                            Save reference
                        </Button>
                    </>
                )}
                {asset.caption && (
                    <div className="reference-caption">
                        <h3>Original caption</h3>
                        <p>{asset.caption}</p>
                    </div>
                )}
                <ErrorMessage error={actions.update.error || actions.remove.error} />
                <div className="delete-reference">
                    {confirmDelete ? (
                        <>
                            <p>Remove this reference from your brand?</p>
                            <Button
                                variant="destructive"
                                disabled={actions.remove.isPending}
                                onClick={async () => {
                                    try {
                                        await actions.remove.mutateAsync(asset.id);
                                        close();
                                    } catch {
                                        /* Shown above. */
                                    }
                                }}
                            >
                                Remove reference
                            </Button>
                            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <button className="danger-link" onClick={() => setConfirmDelete(true)}>
                            <Trash2 size={15} />
                            Remove reference
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
function ProductForm({ product, close }: { product?: Product; close: () => void }) {
    const [name, setName] = useState(product?.name ?? "");
    const [description, setDescription] = useState(product?.description ?? "");
    const [packaging, setPackaging] = useState(product?.packaging ?? "");
    const { saveProduct } = useBrandActions();
    return (
        <form
            className="product-form"
            onSubmit={async (event) => {
                event.preventDefault();
                try {
                    await saveProduct.mutateAsync({ id: product?.id, name, description, packaging });
                    close();
                } catch {
                    /* Shown below. */
                }
            }}
        >
            <Field label="Product name" htmlFor="product-name">
                <Input
                    id="product-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={120}
                />
            </Field>
            <Field label="Description" htmlFor="product-description">
                <textarea
                    id="product-description"
                    value={description}
                    rows={3}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={2000}
                />
            </Field>
            <Field
                label="Packaging details"
                htmlFor="product-packaging"
                hint="Include the variant, size and details that must stay accurate."
            >
                <textarea
                    id="product-packaging"
                    value={packaging}
                    rows={3}
                    onChange={(event) => setPackaging(event.target.value)}
                    maxLength={2000}
                />
            </Field>
            <ErrorMessage error={saveProduct.error} />
            <div className="form-actions">
                <Button type="button" variant="ghost" onClick={close}>
                    Cancel
                </Button>
                <Button disabled={saveProduct.isPending}>Save product</Button>
            </div>
        </form>
    );
}
export function LibraryPage() {
    const query = useAssets();
    const { data: products = [] } = useProducts();
    const [tab, setTab] = useState("uploaded");
    const [selected, setSelected] = useState<Asset | null>(null);
    const [upload, setUpload] = useState(false);
    const [editProduct, setEditProduct] = useState<Product | "new" | null>(null);
    const assets = query.data ?? [];
    const uploaded = assets.filter((asset) => !["instagram", "guidelines"].includes(asset.role));
    const files = assets.filter((asset) =>
        tab === "instagram"
            ? asset.role === "instagram"
            : tab === "guidelines"
              ? asset.role === "guidelines"
              : !["instagram", "guidelines"].includes(asset.role),
    );
    return (
        <div className="page-container">
            <PageHeader
                title="References"
                description="Your products, brand assets and past campaigns."
                action={
                    <Button onClick={() => setUpload(true)}>
                        <Plus size={16} />
                        Add references
                    </Button>
                }
            />
            <div className="library-tabs">
                <div className="tabs" role="tablist" aria-label="Reference types">
                    {[
                        ["uploaded", "Uploaded", uploaded.length],
                        ["instagram", "Instagram", assets.filter((asset) => asset.role === "instagram").length],
                        ["guidelines", "Guidelines", assets.filter((asset) => asset.role === "guidelines").length],
                    ].map(([key, label, count]) => (
                        <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(String(key))}>
                            {label}
                            <span>{count}</span>
                        </button>
                    ))}
                </div>
                {tab === "uploaded" && <span className="muted small">{uploaded.length} / 50 images</span>}
            </div>
            {query.isPending ? (
                <Loading />
            ) : query.error ? (
                <ErrorMessage error={query.error} retry={() => void query.refetch()} />
            ) : (
                <>
                    <div className="reference-grid">
                        {files.map((asset) => (
                            <button className="reference-item" key={asset.id} onClick={() => setSelected(asset)}>
                                <div className="reference-image">
                                    {asset.url && asset.mimeType.startsWith("image/") ? (
                                        <img src={asset.url} alt={asset.name} loading="lazy" />
                                    ) : (
                                        <FileText size={36} />
                                    )}
                                    {asset.isPrimary && (
                                        <span className="primary-reference" title="Primary reference">
                                            <Check size={13} />
                                        </span>
                                    )}
                                </div>
                                <strong>{asset.name}</strong>
                                <span>
                                    {asset.status === "failed"
                                        ? (asset.error ?? "Upload failed")
                                        : asset.productId
                                          ? products.find((product) => product.id === asset.productId)?.name
                                          : asset.role === "product"
                                            ? "Unassigned product"
                                            : asset.role === "instagram"
                                              ? "Instagram"
                                              : asset.role === "guidelines"
                                                ? "Brand guidelines"
                                                : asset.role === "logo"
                                                  ? "Logo"
                                                  : "Style reference"}
                                </span>
                            </button>
                        ))}
                        {tab === "uploaded" && <UploadZone compact count={uploaded.length} />}
                    </div>
                    {files.length === 0 && tab !== "uploaded" && (
                        <div className="empty-state">
                            <Image size={32} />
                            <h2>{tab === "instagram" ? "No Instagram images yet" : "Add your brand guidelines"}</h2>
                            <p>
                                {tab === "instagram"
                                    ? "Import your public profile from brand setup."
                                    : "Upload a PDF with your colors, fonts and logo rules."}
                            </p>
                        </div>
                    )}
                </>
            )}
            {tab === "uploaded" && (
                <section className="products-section">
                    <div className="section-label">
                        <div>
                            <h2>Products</h2>
                            <p className="muted">Keep photos of the same product together.</p>
                        </div>
                        <Button variant="outline" onClick={() => setEditProduct("new")}>
                            <Plus size={15} />
                            Add product
                        </Button>
                    </div>
                    <div className="product-list">
                        {products.map((product) => {
                            const ref = assets.find((asset) => asset.id === product.primaryAssetId);
                            return (
                                <button
                                    key={product.id}
                                    className="product-list-item"
                                    onClick={() => setEditProduct(product)}
                                >
                                    {ref?.url ? (
                                        <img src={ref.url} alt={product.name} />
                                    ) : (
                                        <div className="product-placeholder">
                                            <Image size={18} />
                                        </div>
                                    )}
                                    <div>
                                        <strong>{product.name}</strong>
                                        <p>{product.description || "Add product details"}</p>
                                    </div>
                                    <span>
                                        {product.referenceCount} {product.referenceCount === 1 ? "image" : "images"}
                                    </span>
                                </button>
                            );
                        })}
                        {products.length === 0 && (
                            <p className="muted">
                                Imprint will group products during brand analysis. You can also add a product yourself.
                            </p>
                        )}
                    </div>
                </section>
            )}
            <Modal
                open={Boolean(selected)}
                onOpenChange={(open) => {
                    if (!open) setSelected(null);
                }}
                title={selected?.name ?? "Reference"}
                className="reference-modal"
            >
                {selected && (
                    <AssetDetails
                        key={selected.id}
                        asset={selected}
                        products={products}
                        close={() => setSelected(null)}
                    />
                )}
            </Modal>
            <Modal
                open={upload}
                onOpenChange={setUpload}
                title="Add references"
                description="Upload product photos, style references or your brand guidelines."
            >
                <div className="upload-modal-body">
                    <UploadZone count={uploaded.length} />
                    <UploadZone pdf />
                </div>
            </Modal>
            <Modal
                open={Boolean(editProduct)}
                onOpenChange={(open) => {
                    if (!open) setEditProduct(null);
                }}
                title={editProduct === "new" ? "Add product" : "Edit product"}
            >
                {editProduct && (
                    <ProductForm
                        key={editProduct === "new" ? "new" : editProduct.id}
                        product={editProduct === "new" ? undefined : editProduct}
                        close={() => setEditProduct(null)}
                    />
                )}
            </Modal>
        </div>
    );
}
