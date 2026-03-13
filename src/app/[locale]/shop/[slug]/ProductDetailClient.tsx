"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ShoppingCart, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/hooks/useCart";
import { formatTWD } from "@/lib/currency";
import { toast } from "sonner";
import type { ProductWithVariants } from "@/lib/supabase/types";

// Same color map as ProductCard
const COLOR_CSS: Record<string, string> = {
  white: "#F8F8F8", black: "#1C1C1C", blue: "#1D4ED8", navy: "#1E3A5F",
  red: "#DC2626", green: "#16A34A", yellow: "#EAB308", pink: "#EC4899",
  purple: "#9333EA", grey: "#6B7280", gray: "#6B7280", gold: "#D97706",
  silver: "#9CA3AF", orange: "#EA580C", brown: "#92400E",
};
function colorToCss(color: string) { return COLOR_CSS[color.toLowerCase().trim()] ?? "#6B7280"; }

interface ProductDetailClientProps {
  product: ProductWithVariants;
  locale: string;
}

export function ProductDetailClient({ product, locale }: ProductDetailClientProps) {
  const t = useTranslations("shop");
  const { addItem } = useCart();

  const name = locale === "zh-TW" ? product.name_zh : product.name_en;
  const description = locale === "zh-TW" ? product.description_zh : product.description_en;
  const preorderNote = locale === "zh-TW" ? product.preorder_note_zh : product.preorder_note_en;

  // Unique colors preserving insertion order
  const colors = [...new Map(
    product.product_variants.map((v) => [v.color, v])
  ).values()].map((v) => v.color);

  const [selectedColor, setSelectedColor] = useState<string>(colors[0] ?? "");
  const [selectedSize, setSelectedSize] = useState<string>(() => {
    const firstForColor = product.product_variants.find((v) => v.color === colors[0]);
    return firstForColor?.size ?? "";
  });

  // Update size when color changes (pick first available size for new color)
  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    const firstAvailable = product.product_variants.find(
      (v) => v.color === color && (product.is_preorder || v.stock_quantity > 0)
    ) ?? product.product_variants.find((v) => v.color === color);
    setSelectedSize(firstAvailable?.size ?? "");
  };

  // Sizes available for selected color
  const sizesForColor = product.product_variants
    .filter((v) => v.color === selectedColor)
    .map((v) => v.size);

  const selectedVariant = product.product_variants.find(
    (v) => v.color === selectedColor && v.size === selectedSize
  );

  const colorImage = product.product_variants.find((v) => v.color === selectedColor)?.color_image_url
    ?? product.base_image_url;

  const inStock = product.is_preorder || (selectedVariant?.stock_quantity ?? 0) > 0;
  const lowStock = !product.is_preorder && selectedVariant &&
    selectedVariant.stock_quantity > 0 && selectedVariant.stock_quantity <= 5;

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productSlug: product.slug,
      nameEn: product.name_en,
      nameZh: product.name_zh,
      size: selectedVariant.size,
      color: selectedVariant.color,
      imageUrl: colorImage,
      price: product.price_twd,
      isPreorder: product.is_preorder,
    });
    toast.success(locale === "zh-TW" ? "已加入購物車" : "Added to cart", {
      description: `${name} — ${selectedVariant.color} / ${selectedVariant.size}`,
    });
  };

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      {/* ── Image ──────────────────────────────────────────────────── */}
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-800">
        {colorImage ? (
          <Image
            key={colorImage}
            src={colorImage}
            alt={`${name} — ${selectedColor}`}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover transition-all duration-500"
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <span className="text-8xl font-black text-white/5 select-none">MATSIDE</span>
          </div>
        )}
        {product.is_preorder && (
          <div className="absolute top-4 left-4">
            <Badge variant="preorder">{t("preorderBadge")}</Badge>
          </div>
        )}
      </div>

      {/* ── Details ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-black text-white sm:text-4xl">{name}</h1>
          <p className="mt-2 text-3xl font-bold text-white/90">
            {formatTWD(product.price_twd, locale)}
          </p>
        </div>

        {product.is_preorder && preorderNote && (
          <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
            <p className="text-sm text-amber-300">{preorderNote}</p>
          </div>
        )}

        {description && (
          <>
            <Separator className="bg-white/10" />
            {description.startsWith("<") ? (
              <div
                className="rich-text text-sm text-white/60"
                dangerouslySetInnerHTML={{ __html: description }}
              />
            ) : (
              <p className="text-sm text-white/60 leading-relaxed">{description}</p>
            )}
          </>
        )}

        <Separator className="bg-white/10" />

        {/* Color selector */}
        {colors.length > 0 && (
          <div>
            <label className="mb-3 block text-sm font-medium text-white/70">
              Color — <span className="text-white capitalize">{selectedColor}</span>
            </label>
            <div className="flex flex-wrap gap-3">
              {colors.map((color) => {
                const variants = product.product_variants.filter((v) => v.color === color);
                const available = product.is_preorder || variants.some((v) => v.stock_quantity > 0);
                const isSelected = selectedColor === color;
                return (
                  <button
                    key={color}
                    onClick={() => handleColorChange(color)}
                    title={color}
                    className={[
                      "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                      isSelected
                        ? "border-white bg-white/10 text-white"
                        : available
                        ? "border-white/20 text-white/60 hover:border-white/50 hover:text-white"
                        : "border-white/10 text-white/25 opacity-50 cursor-not-allowed",
                    ].join(" ")}
                    disabled={!available}
                  >
                    <span
                      className="h-4 w-4 flex-shrink-0 rounded-full border border-white/20"
                      style={{ backgroundColor: colorToCss(color) }}
                    />
                    <span className="capitalize">{color}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Size selector */}
        {sizesForColor.length > 0 && (
          <div>
            <label className="mb-3 block text-sm font-medium text-white/70">
              {t("selectSize")}
            </label>
            <div className="flex flex-wrap gap-2">
              {sizesForColor.map((size) => {
                const variant = product.product_variants.find(
                  (v) => v.color === selectedColor && v.size === size
                );
                const available = product.is_preorder || (variant?.stock_quantity ?? 0) > 0;
                return (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    disabled={!available}
                    className={[
                      "rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                      selectedSize === size
                        ? "border-white bg-white text-slate-900"
                        : available
                        ? "border-white/20 text-white/70 hover:border-white/50"
                        : "border-white/10 text-white/25 line-through cursor-not-allowed",
                    ].join(" ")}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
            {lowStock && (
              <p className="mt-2 text-sm text-amber-400">
                {t("lowStock", { count: selectedVariant?.stock_quantity })}
              </p>
            )}
          </div>
        )}

        {/* Add to cart */}
        <Button
          onClick={handleAddToCart}
          disabled={!inStock || !selectedVariant}
          size="lg"
          className="w-full gap-2 bg-white text-slate-900 hover:bg-white/90 disabled:opacity-40"
        >
          <ShoppingCart className="h-5 w-5" />
          {!inStock ? t("outOfStock") : t("addToCart")}
        </Button>
      </div>
    </div>
  );
}
