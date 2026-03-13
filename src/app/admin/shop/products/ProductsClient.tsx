"use client";

import { Fragment, useState, useTransition, useCallback } from "react";
import Image from "next/image";
import {
  Plus, Pencil, Trash2, Package, X, Save, ChevronDown, ChevronUp,
  AlertTriangle, Check, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Product, ProductVariant } from "@/lib/supabase/types";

type ProductWithVariants = Product & { product_variants: ProductVariant[] };

interface ProductsClientProps {
  products: ProductWithVariants[];
}

// ─── helpers ────────────────────────────────────────────────────────────────

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const COLOR_ABBREV: Record<string, string> = {
  white: "W", black: "B", blue: "BL", navy: "NV", red: "R",
  green: "G", yellow: "Y", pink: "PK", purple: "PU",
  grey: "GR", gray: "GR", gold: "GD", silver: "SV",
};

function colorAbbr(color: string): string {
  return COLOR_ABBREV[color.toLowerCase().trim()] ?? color.slice(0, 2).toUpperCase();
}

function skuPrefix(slug: string): string {
  return slug.split("-").filter(Boolean).slice(0, 3).map((p) => p.toUpperCase()).join("-");
}

function autoSku(slug: string, size: string, color: string): string {
  const parts = [skuPrefix(slug), colorAbbr(color), size.toUpperCase()].filter(Boolean);
  return parts.join("-");
}

// ─── Size presets ────────────────────────────────────────────────────────────

const SIZE_PRESETS = [
  { label: "Kids Gi",    sizes: ["M000", "M00", "M0", "M1", "M2", "M3", "M4"] },
  { label: "Adult Gi",   sizes: ["A0", "A1", "A2", "A3", "A4", "F1", "F2", "F3", "F4"] },
  { label: "Kids No-Gi", sizes: ["Y-XS", "Y-S", "Y-M", "Y-L"] },
  { label: "Adult No-Gi",sizes: ["XS", "S", "M", "L", "XL", "XXL"] },
] as const;

// ─── Variant row editor ──────────────────────────────────────────────────────

interface VariantRowProps {
  variant: Partial<ProductVariant> & { _key: string };
  productSlug: string;
  onChange: (key: string, updated: Partial<ProductVariant>) => void;
  onRemove: (key: string) => void;
}

function VariantRow({ variant, productSlug, onChange, onRemove }: VariantRowProps) {
  const currentSku = variant.sku ?? "";

  const handleSizeChange = (newSize: string) => {
    const prevAuto = autoSku(productSlug, variant.size ?? "", variant.color ?? "");
    const updates: Partial<ProductVariant> = { size: newSize };
    if (!currentSku || currentSku === prevAuto) {
      updates.sku = autoSku(productSlug, newSize, variant.color ?? "");
    }
    onChange(variant._key, updates);
  };

  const handleColorChange = (newColor: string) => {
    const prevAuto = autoSku(productSlug, variant.size ?? "", variant.color ?? "");
    const updates: Partial<ProductVariant> = { color: newColor };
    if (!currentSku || currentSku === prevAuto) {
      updates.sku = autoSku(productSlug, variant.size ?? "", newColor);
    }
    onChange(variant._key, updates);
  };

  return (
    <tr className="border-b border-white/5">
      <td className="py-2 pr-2">
        <Input
          value={variant.size ?? ""}
          onChange={(e) => handleSizeChange(e.target.value)}
          placeholder="A2"
          className="h-8 border-white/20 bg-white/5 text-white placeholder:text-white/20 text-sm"
        />
      </td>
      <td className="py-2 pr-2">
        <Input
          value={variant.color ?? ""}
          onChange={(e) => handleColorChange(e.target.value)}
          placeholder="white"
          className="h-8 border-white/20 bg-white/5 text-white placeholder:text-white/20 text-sm"
        />
      </td>
      <td className="py-2 pr-2">
        <Input
          type="number"
          min={0}
          value={variant.stock_quantity ?? 0}
          onChange={(e) =>
            onChange(variant._key, { stock_quantity: parseInt(e.target.value) || 0 })
          }
          className="h-8 w-20 border-white/20 bg-white/5 text-white text-sm"
        />
      </td>
      <td className="py-2 pr-2">
        <Input
          value={variant.sku ?? ""}
          onChange={(e) => onChange(variant._key, { sku: e.target.value })}
          placeholder="AUTO"
          className="h-8 border-white/20 bg-white/5 text-white placeholder:text-white/20 text-sm font-mono"
        />
      </td>
      <td className="py-2 text-right">
        <button
          type="button"
          onClick={() => onRemove(variant._key)}
          className="text-white/30 hover:text-red-400 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

// ─── Product form dialog ─────────────────────────────────────────────────────

type DraftVariant = Partial<ProductVariant> & { _key: string; id?: string };

interface ProductFormProps {
  product: ProductWithVariants | null;
  onClose: () => void;
  onSaved: (product: ProductWithVariants) => void;
}

function ProductForm({ product, onClose, onSaved }: ProductFormProps) {
  const isEdit = product !== null;
  const [isPending, startTransition] = useTransition();

  const [nameEn, setNameEn] = useState(product?.name_en ?? "");
  const [nameZh, setNameZh] = useState(product?.name_zh ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [descEn, setDescEn] = useState(product?.description_en ?? "");
  const [descZh, setDescZh] = useState(product?.description_zh ?? "");
  const [price, setPrice] = useState(String(product?.price_twd ?? ""));
  const [imageUrl, setImageUrl] = useState(product?.base_image_url ?? "");
  const [isPreorder, setIsPreorder] = useState(product?.is_preorder ?? false);
  const [preorderNoteEn, setPreorderNoteEn] = useState(product?.preorder_note_en ?? "");
  const [preorderNoteZh, setPreorderNoteZh] = useState(product?.preorder_note_zh ?? "");
  const [isActive, setIsActive] = useState(product?.is_active ?? true);

  const initVariants = (): DraftVariant[] =>
    (product?.product_variants ?? []).map((v) => ({ ...v, _key: v.id }));

  const [variants, setVariants] = useState<DraftVariant[]>(initVariants);
  const [quickColor, setQuickColor] = useState("");

  // colorImages: map of color → image URL (shared across all variants of same color)
  const initColorImages = (): Record<string, string> => {
    const map: Record<string, string> = {};
    (product?.product_variants ?? []).forEach((v) => {
      if (v.color && v.color_image_url) map[v.color] = v.color_image_url;
    });
    return map;
  };
  const [colorImages, setColorImages] = useState<Record<string, string>>(initColorImages);
  const [uploadingColor, setUploadingColor] = useState<string | null>(null);

  const uniqueColors = [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[];

  const handleColorImageUpload = async (color: string, file: File) => {
    setUploadingColor(color);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || json.error) { toast.error(json.error ?? "Upload failed."); return; }
      setColorImages((prev) => ({ ...prev, [color]: json.url }));
      toast.success(`Image set for "${color}"`);
    } catch { toast.error("Upload failed."); }
    finally { setUploadingColor(null); }
  };

  const handleNameEnBlur = () => {
    if (!isEdit && !slug) setSlug(slugify(nameEn));
  };

  const addVariant = () => {
    const key = `new-${Date.now()}`;
    setVariants((prev) => [
      ...prev,
      { _key: key, size: "", color: "", stock_quantity: 0, sku: "" },
    ]);
  };

  const addPreset = (sizes: readonly string[]) => {
    const color = quickColor.trim() || "white";
    const existingSizes = new Set(variants.map((v) => `${v.size}|${v.color}`));
    const newRows: DraftVariant[] = sizes
      .filter((s) => !existingSizes.has(`${s}|${color}`))
      .map((size) => ({
        _key: `new-${Date.now()}-${Math.random()}`,
        size,
        color,
        stock_quantity: 0,
        sku: autoSku(slug, size, color),
      }));
    if (newRows.length === 0) {
      toast.info("All sizes in this preset already exist.");
      return;
    }
    setVariants((prev) => [...prev, ...newRows]);
  };

  const updateVariant = useCallback(
    (key: string, updated: Partial<ProductVariant>) => {
      setVariants((prev) =>
        prev.map((v) => (v._key === key ? { ...v, ...updated } : v))
      );
    },
    []
  );

  const removeVariant = useCallback((key: string) => {
    setVariants((prev) => prev.filter((v) => v._key !== key));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameEn.trim() || !nameZh.trim() || !slug.trim() || !price) {
      toast.error("Please fill in all required fields.");
      return;
    }
    const priceNum = parseInt(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error("Price must be a positive number.");
      return;
    }
    const invalidVariant = variants.find((v) => !v.size?.trim() || !v.color?.trim());
    if (invalidVariant) {
      toast.error("All variants need a size and color.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();

      const productData = {
        slug: slug.trim(),
        name_en: nameEn.trim(),
        name_zh: nameZh.trim(),
        description_en: descEn.trim() || null,
        description_zh: descZh.trim() || null,
        price_twd: priceNum,
        base_image_url: imageUrl.trim() || null,
        is_preorder: isPreorder,
        preorder_note_en: isPreorder ? preorderNoteEn.trim() || null : null,
        preorder_note_zh: isPreorder ? preorderNoteZh.trim() || null : null,
        is_active: isActive,
      };

      let productId: string;

      if (isEdit) {
        const { data, error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", product.id)
          .select()
          .single();
        if (error) { toast.error("Failed to update product."); return; }
        productId = data.id;
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert(productData)
          .select()
          .single();
        if (error) {
          toast.error(error.message.includes("slug") ? "Slug already exists." : "Failed to create product.");
          return;
        }
        productId = data.id;
      }

      // Sync variants
      if (isEdit) {
        const originalIds = (product.product_variants ?? []).map((v) => v.id);
        const currentIds = variants.filter((v) => v.id).map((v) => v.id!);
        const deletedIds = originalIds.filter((id) => !currentIds.includes(id));
        if (deletedIds.length > 0) {
          await supabase.from("product_variants").delete().in("id", deletedIds);
        }
      }

      for (const v of variants) {
        const variantColor = v.color!.trim();
        const variantData = {
          product_id: productId,
          size: v.size!.trim(),
          color: variantColor,
          stock_quantity: v.stock_quantity ?? 0,
          sku: v.sku?.trim() || null,
          color_image_url: colorImages[variantColor] ?? null,
        };
        if (v.id) {
          await supabase.from("product_variants").update(variantData).eq("id", v.id);
        } else {
          await supabase.from("product_variants").insert(variantData);
        }
      }

      // Fetch fresh product with variants
      const { data: fresh } = await supabase
        .from("products")
        .select("*, product_variants(*)")
        .eq("id", productId)
        .single();

      toast.success(isEdit ? "Product updated." : "Product created.");
      if (fresh) onSaved(fresh as ProductWithVariants);
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-3 sm:p-4">
      <div className="relative my-4 sm:my-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? "Edit Product" : "Add New Product"}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Names */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Name (English) *</Label>
              <Input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                onBlur={handleNameEnBlur}
                placeholder="Matside Competition Gi"
                required
                className="border-white/20 bg-white/5 text-white placeholder:text-white/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">名稱（中文）*</Label>
              <Input
                value={nameZh}
                onChange={(e) => setNameZh(e.target.value)}
                placeholder="Matside 競賽道衣"
                required
                className="border-white/20 bg-white/5 text-white placeholder:text-white/20"
              />
            </div>
          </div>

          {/* Slug + Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">URL Slug *</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="matside-gi-white"
                required
                className="border-white/20 bg-white/5 text-white placeholder:text-white/20 font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Price (TWD) *</Label>
              <Input
                type="number"
                min={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="3800"
                required
                className="border-white/20 bg-white/5 text-white placeholder:text-white/20"
              />
            </div>
          </div>

          {/* Descriptions */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Description (English)</Label>
              <RichTextEditor
                value={descEn}
                onChange={setDescEn}
                placeholder="Product description..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">商品描述（中文）</Label>
              <RichTextEditor
                value={descZh}
                onChange={setDescZh}
                placeholder="商品描述..."
              />
            </div>
          </div>

          {/* Image Upload */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Product Image</Label>
            <ImageUploader value={imageUrl} onChange={setImageUrl} />
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
              <div
                onClick={() => setIsActive(!isActive)}
                className={`relative h-5 w-9 rounded-full transition-colors ${isActive ? "bg-green-500" : "bg-white/20"}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              Active (visible in shop)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
              <div
                onClick={() => setIsPreorder(!isPreorder)}
                className={`relative h-5 w-9 rounded-full transition-colors ${isPreorder ? "bg-amber-500" : "bg-white/20"}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isPreorder ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              Preorder item
            </label>
          </div>

          {/* Preorder notes */}
          {isPreorder && (
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-400/70">Preorder Note (English)</Label>
                <Input
                  value={preorderNoteEn}
                  onChange={(e) => setPreorderNoteEn(e.target.value)}
                  placeholder="Ships in 4–6 weeks"
                  className="border-amber-500/20 bg-white/5 text-white placeholder:text-white/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-400/70">預購說明（中文）</Label>
                <Input
                  value={preorderNoteZh}
                  onChange={(e) => setPreorderNoteZh(e.target.value)}
                  placeholder="預計 4–6 週出貨"
                  className="border-amber-500/20 bg-white/5 text-white placeholder:text-white/20"
                />
              </div>
            </div>
          )}

          {/* Color Images */}
          {uniqueColors.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-white/50">Color Images</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {uniqueColors.map((color) => {
                  const imgUrl = colorImages[color];
                  const isUploading = uploadingColor === color;
                  return (
                    <div key={color} className="space-y-1.5">
                      <p className="text-xs text-white/40 capitalize">{color}</p>
                      <label className={[
                        "relative flex h-24 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border transition-colors",
                        imgUrl ? "border-white/20" : "border-dashed border-white/10 hover:border-white/20 hover:bg-white/5",
                      ].join(" ")}>
                        {imgUrl ? (
                          <>
                            <Image src={imgUrl} alt={color} fill sizes="120px" className="object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
                              <span className="text-xs text-white font-medium">Replace</span>
                            </div>
                          </>
                        ) : isUploading ? (
                          <Loader2 className="h-5 w-5 animate-spin text-white/30" />
                        ) : (
                          <>
                            <Plus className="h-5 w-5 text-white/20" />
                            <span className="mt-1 text-[10px] text-white/30">Add image</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleColorImageUpload(color, file);
                          }}
                        />
                      </label>
                      {imgUrl && (
                        <button
                          type="button"
                          onClick={() => setColorImages((p) => { const n = {...p}; delete n[color]; return n; })}
                          className="w-full text-center text-[10px] text-white/30 hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-white/25">One image per color — shared across all sizes of that color.</p>
            </div>
          )}

          {/* Variants */}
          <div className="space-y-3">
            <Label className="text-xs text-white/50">Variants (sizes / colors)</Label>

            {/* Quick-add presets */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
              <p className="text-xs text-white/40 font-medium">Quick add size set</p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={quickColor}
                  onChange={(e) => setQuickColor(e.target.value)}
                  placeholder="Color (e.g. black)"
                  className="h-8 w-36 border-white/20 bg-white/5 text-white placeholder:text-white/20 text-xs"
                />
                {SIZE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => addPreset(preset.sizes)}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    {preset.label}
                    <span className="ml-1.5 text-white/30">({preset.sizes.length})</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-white/25">Enter a color then click a preset to bulk-add sizes. SKUs are auto-generated.</p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-white/30">{variants.length} variant{variants.length !== 1 ? "s" : ""}</span>
              <button
                type="button"
                onClick={addVariant}
                className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1 text-xs text-white/60 hover:bg-white/5 hover:text-white transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add single variant
              </button>
            </div>

            {variants.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-3 py-2 text-left text-xs font-medium text-white/40">Size</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-white/40">Color</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-white/40">Stock</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-white/40">SKU <span className="text-white/20 font-normal">(auto)</span></th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="px-3">
                    {variants.map((v) => (
                      <VariantRow
                        key={v._key}
                        variant={v}
                        productSlug={slug}
                        onChange={updateVariant}
                        onRemove={removeVariant}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 py-6 text-center text-sm text-white/30">
                No variants yet. Use quick add above or click &quot;Add single variant&quot;.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-white/50 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-white font-semibold text-slate-900 hover:bg-white/90"
            >
              {isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> {isEdit ? "Save Changes" : "Create Product"}</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete confirm dialog ───────────────────────────────────────────────────

function DeleteDialog({
  product,
  onClose,
  onDeleted,
}: {
  product: ProductWithVariants;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.from("products").delete().eq("id", product.id);
      if (error) { toast.error("Failed to delete product."); return; }
      toast.success("Product deleted.");
      onDeleted(product.id);
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <Trash2 className="h-5 w-5 text-red-400" />
        </div>
        <h3 className="mb-1 text-base font-semibold text-white">Delete product?</h3>
        <p className="mb-5 text-sm text-white/50">
          <span className="font-medium text-white">{product.name_en}</span> and all its variants will be permanently deleted. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1 text-white/50 hover:text-white">
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={isPending}
            className="flex-1 bg-red-500 text-white hover:bg-red-600"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main client component ───────────────────────────────────────────────────

export function ProductsClient({ products: initialProducts }: ProductsClientProps) {
  const [products, setProducts] = useState(initialProducts);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithVariants | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductWithVariants | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const openAdd = () => { setEditingProduct(null); setFormOpen(true); };
  const openEdit = (p: ProductWithVariants) => { setEditingProduct(p); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditingProduct(null); };

  const handleSaved = (updated: ProductWithVariants) => {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [updated, ...prev];
    });
  };

  const handleDeleted = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <>
      {/* Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
          <span className="text-sm text-white/50">{products.length} products</span>
          <Button
            onClick={openAdd}
            size="sm"
            className="bg-white font-semibold text-slate-900 hover:bg-white/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Product
          </Button>
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-white/30">
            <Package className="h-10 w-10" />
            <p className="text-sm">No products yet.</p>
            <Button onClick={openAdd} variant="ghost" size="sm" className="text-white/50 hover:text-white">
              <Plus className="mr-1.5 h-4 w-4" /> Add your first product
            </Button>
          </div>
        ) : (
          <>
            {/* ── Mobile card list (< md) ─────────────────────────────── */}
            <div className="divide-y divide-white/5 md:hidden">
              {products.map((product) => {
                const isExpanded = expandedId === product.id;
                const hasLowStock = product.product_variants.some((v) => v.stock_quantity < 5);
                const totalStock = product.product_variants.reduce((s, v) => s + v.stock_quantity, 0);

                return (
                  <div key={product.id} className="p-4 space-y-3">
                    {/* Top row: image + name + actions */}
                    <div className="flex items-start gap-3">
                      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-slate-800">
                        {product.base_image_url ? (
                          <Image src={product.base_image_url} alt={product.name_en} fill sizes="56px" className="object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Package className="h-5 w-5 text-white/20" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{product.name_en}</p>
                        <p className="text-xs text-white/40 truncate">{product.name_zh}</p>
                        <p className="mt-1 text-sm font-semibold text-white/80">NT$ {product.price_twd.toLocaleString()}</p>
                      </div>

                      {/* Action buttons — always visible on mobile */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEdit(product)}
                          className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => setDeletingProduct(product)}
                          className="flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 p-1.5 text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Badges + variant toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {product.is_active ? (
                          <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/20 text-[10px]">
                            <Check className="mr-1 h-2.5 w-2.5" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-white/5 text-white/30 border-white/10 text-[10px]">Hidden</Badge>
                        )}
                        {product.is_preorder && <Badge variant="preorder" className="text-[10px]">Preorder</Badge>}
                        {hasLowStock && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-400">
                            <AlertTriangle className="h-3 w-3" /> Low stock
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : product.id)}
                        className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors"
                      >
                        {product.product_variants.length} variants
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>

                    {/* Expanded variants */}
                    {isExpanded && (
                      <div className="rounded-xl border border-white/10 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                              <th className="px-3 py-2 text-left font-medium text-white/40">Size</th>
                              <th className="px-3 py-2 text-left font-medium text-white/40">Color</th>
                              <th className="px-3 py-2 text-center font-medium text-white/40">Stock</th>
                            </tr>
                          </thead>
                          <tbody>
                            {product.product_variants.map((v) => (
                              <tr key={v.id} className="border-b border-white/5">
                                <td className="px-3 py-2 text-white/80">{v.size}</td>
                                <td className="px-3 py-2 text-white/60 capitalize">{v.color}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={v.stock_quantity === 0 ? "text-red-400 font-bold" : v.stock_quantity < 5 ? "text-amber-400 font-bold" : "text-white/80"}>
                                    {v.stock_quantity}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="px-3 py-2 text-[10px] text-white/30">
                          Total: {totalStock} units
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Desktop table (md+) ─────────────────────────────────── */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="px-4 py-3 text-left font-medium text-white/40">Product</th>
                  <th className="px-4 py-3 text-left font-medium text-white/40">Slug</th>
                  <th className="px-4 py-3 text-center font-medium text-white/40">Price</th>
                  <th className="px-4 py-3 text-center font-medium text-white/40">Variants</th>
                  <th className="px-4 py-3 text-center font-medium text-white/40">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-white/40">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const isExpanded = expandedId === product.id;
                  const totalStock = product.product_variants.reduce((sum, v) => sum + v.stock_quantity, 0);
                  const hasLowStock = product.product_variants.some((v) => v.stock_quantity < 5);

                  return (
                    <Fragment key={product.id}>
                      <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-slate-800">
                              {product.base_image_url ? (
                                <Image src={product.base_image_url} alt={product.name_en} fill sizes="40px" className="object-cover" />
                              ) : (
                                <div className="flex h-full items-center justify-center">
                                  <Package className="h-4 w-4 text-white/20" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-white line-clamp-1">{product.name_en}</p>
                              <p className="text-xs text-white/40 line-clamp-1">{product.name_zh}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-white/40">{product.slug}</td>
                        <td className="px-4 py-3 text-center text-white/80">NT$ {product.price_twd.toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : product.id)}
                            className="inline-flex items-center gap-1 text-white/60 hover:text-white transition-colors"
                          >
                            <span className="font-medium">{product.product_variants.length}</span>
                            <span className="text-xs text-white/30">variants</span>
                            {hasLowStock && <AlertTriangle className="h-3.5 w-3.5 text-amber-400 ml-1" />}
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {product.is_active ? (
                              <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/20">
                                <Check className="mr-1 h-3 w-3" /> Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-white/5 text-white/30 border-white/10">Hidden</Badge>
                            )}
                            {product.is_preorder && <Badge variant="preorder">Preorder</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(product)} className="h-7 text-white/40 hover:text-white text-xs">
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeletingProduct(product)} className="h-7 text-white/40 hover:text-red-400 text-xs">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="border-b border-white/5 bg-white/[0.01]">
                          <td colSpan={6} className="px-6 pb-4 pt-2">
                            <div className="rounded-xl border border-white/10 overflow-hidden">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-white/10 bg-white/5">
                                    <th className="px-3 py-2 text-left font-medium text-white/40">Size</th>
                                    <th className="px-3 py-2 text-left font-medium text-white/40">Color</th>
                                    <th className="px-3 py-2 text-center font-medium text-white/40">Stock</th>
                                    <th className="px-3 py-2 text-left font-medium text-white/40">SKU</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {product.product_variants.map((v) => (
                                    <tr key={v.id} className="border-b border-white/5">
                                      <td className="px-3 py-2 text-white/80">{v.size}</td>
                                      <td className="px-3 py-2 text-white/60 capitalize">{v.color}</td>
                                      <td className="px-3 py-2 text-center">
                                        <span className={v.stock_quantity === 0 ? "text-red-400 font-bold" : v.stock_quantity < 5 ? "text-amber-400 font-bold" : "text-white/80"}>
                                          {v.stock_quantity}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 font-mono text-white/40">{v.sku ?? "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <p className="mt-2 text-xs text-white/30">
                              Total stock: <span className="text-white/60 font-medium">{totalStock}</span> units across {product.product_variants.length} variants
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Dialogs */}
      {formOpen && (
        <ProductForm
          product={editingProduct}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      )}
      {deletingProduct && (
        <DeleteDialog
          product={deletingProduct}
          onClose={() => setDeletingProduct(null)}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}
