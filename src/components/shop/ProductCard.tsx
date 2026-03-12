"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import { ShoppingCart, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";
import { formatTWD } from "@/lib/currency";
import { Link } from "@/i18n/navigation";
import { toast } from "sonner";
import type { ProductWithVariants } from "@/lib/supabase/types";

interface ProductCardProps {
  product: ProductWithVariants;
  index?: number;
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { addItem } = useCart();

  const name = locale === "zh-TW" ? product.name_zh : product.name_en;
  const sizes = [...new Set(product.product_variants.map((v) => v.size))];
  const [selectedSize, setSelectedSize] = useState<string>(sizes[0] ?? "");

  const selectedVariant = product.product_variants.find(
    (v) => v.size === selectedSize
  );
  const inStock =
    product.is_preorder || (selectedVariant?.stock_quantity ?? 0) > 0;
  const lowStock =
    !product.is_preorder &&
    selectedVariant &&
    selectedVariant.stock_quantity > 0 &&
    selectedVariant.stock_quantity <= 5;

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
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
      className="group relative flex flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden hover:border-white/20 transition-all duration-300"
    >
      {/* Image area */}
      <div className="relative aspect-square overflow-hidden bg-slate-800">
        {product.base_image_url ? (
          <Image
            src={product.base_image_url}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <span className="text-5xl font-black text-white/10 select-none">BJJ</span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.is_preorder && (
            <Badge variant="preorder">{t("shop.preorderBadge")}</Badge>
          )}
          {lowStock && (
            <Badge variant="destructive">
              {t("shop.lowStock", { count: selectedVariant?.stock_quantity })}
            </Badge>
          )}
          {!inStock && !product.is_preorder && (
            <Badge variant="secondary">{t("shop.outOfStock")}</Badge>
          )}
        </div>

        {/* Quick view overlay */}
        <Link
          href={`/shop/${product.slug}`}
          className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all duration-300 opacity-0 group-hover:opacity-100"
        >
          <span className="flex items-center gap-2 rounded-full border border-white/50 bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-sm">
            <Eye className="h-4 w-4" />
            {t("shop.viewDetails")}
          </span>
        </Link>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-semibold text-white leading-tight line-clamp-2">{name}</h3>
          <p className="mt-1 text-lg font-bold text-white/90">
            {formatTWD(product.price_twd, locale)}
          </p>
        </div>

        {/* Size selector */}
        {sizes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sizes.map((size) => {
              const variant = product.product_variants.find((v) => v.size === size);
              const available = product.is_preorder || (variant?.stock_quantity ?? 0) > 0;
              return (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  disabled={!available}
                  className={[
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-all",
                    selectedSize === size
                      ? "border-white bg-white text-slate-900"
                      : available
                      ? "border-white/20 text-white/70 hover:border-white/50"
                      : "border-white/10 text-white/30 line-through cursor-not-allowed",
                  ].join(" ")}
                >
                  {size}
                </button>
              );
            })}
          </div>
        )}

        {/* Add to cart */}
        <Button
          onClick={handleAddToCart}
          disabled={!inStock || !selectedVariant}
          className="mt-auto w-full gap-2 bg-white text-slate-900 hover:bg-white/90 disabled:opacity-40"
        >
          <ShoppingCart className="h-4 w-4" />
          {!inStock ? t("shop.outOfStock") : t("shop.addToCart")}
        </Button>
      </div>
    </motion.div>
  );
}
