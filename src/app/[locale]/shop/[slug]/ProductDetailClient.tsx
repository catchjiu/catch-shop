"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";
import type { ProductWithVariants } from "@/lib/supabase/types";

interface ProductDetailClientProps {
  product: ProductWithVariants;
  locale: string;
}

export function ProductDetailClient({ product, locale }: ProductDetailClientProps) {
  const t = useTranslations("shop");
  const { addItem } = useCart();

  const sizes = [...new Set(product.product_variants.map((v) => v.size))];
  const [selectedSize, setSelectedSize] = useState<string>(sizes[0] ?? "");

  const selectedVariant = product.product_variants.find(
    (v) => v.size === selectedSize
  );
  const inStock =
    product.is_preorder || (selectedVariant?.stock_quantity ?? 0) > 0;
  const name = locale === "zh-TW" ? product.name_zh : product.name_en;

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
      imageUrl: product.base_image_url,
      price: product.price_twd,
      isPreorder: product.is_preorder,
    });
    toast.success(locale === "zh-TW" ? "已加入購物車" : "Added to cart", {
      description: `${name} — ${selectedVariant.size}`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Size selection */}
      <div>
        <label className="mb-2 block text-sm font-medium text-white/70">
          {t("selectSize")}
        </label>
        <div className="flex flex-wrap gap-2">
          {sizes.map((size) => {
            const variant = product.product_variants.find((v) => v.size === size);
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
                {!available && !product.is_preorder && (
                  <span className="ml-1 text-xs">✕</span>
                )}
              </button>
            );
          })}
        </div>
        {selectedVariant && !product.is_preorder && selectedVariant.stock_quantity > 0 && selectedVariant.stock_quantity <= 5 && (
          <p className="mt-2 text-sm text-amber-400">
            {t("lowStock", { count: selectedVariant.stock_quantity })}
          </p>
        )}
      </div>

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
  );
}
