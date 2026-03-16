"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatTWD } from "@/lib/currency";
import type { ProductWithVariants, ProductOptionGroup } from "@/lib/supabase/types";

interface ProductCardProps {
  product: ProductWithVariants;
  index?: number;
}

// CSS color approximations for known color names
const COLOR_CSS: Record<string, string> = {
  white: "#F8F8F8",
  black: "#1C1C1C",
  blue: "#1D4ED8",
  navy: "#1E3A5F",
  red: "#DC2626",
  green: "#16A34A",
  yellow: "#EAB308",
  pink: "#EC4899",
  purple: "#9333EA",
  grey: "#6B7280",
  gray: "#6B7280",
  gold: "#D97706",
  silver: "#9CA3AF",
  orange: "#EA580C",
  brown: "#92400E",
};

function colorToCss(color: string): string {
  return COLOR_CSS[color.toLowerCase().trim()] ?? "#6B7280";
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const t = useTranslations();
  const locale = useLocale();
  const name = locale === "zh-TW" ? product.name_zh : product.name_en;

  // Detect if any option group uses absolute pricing
  const optionGroups = (product.options ?? []) as ProductOptionGroup[];
  const absoluteGroup = optionGroups.find((g) => g.useAbsolutePrice && g.choices.length > 0);
  const minOptionPrice = absoluteGroup
    ? Math.min(...absoluteGroup.choices.map((c) => c.price ?? 0))
    : null;

  // Unique colors in order of first appearance
  const colors = [...new Map(
    product.product_variants.map((v) => [v.color, v])
  ).values()].map((v) => v.color);

  const [selectedColor, setSelectedColor] = useState<string>(colors[0] ?? "");

  // Variants for selected color
  const colorVariants = product.product_variants.filter((v) => v.color === selectedColor);
  const colorImage = colorVariants[0]?.color_image_url ?? product.base_image_url;
  const totalStock = colorVariants.reduce((s, v) => s + v.stock_quantity, 0);
  const inStock = product.is_preorder || totalStock > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
      className="group relative flex flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden hover:border-white/20 transition-all duration-300"
    >
      {/* Image area */}
      <div className="relative aspect-square overflow-hidden bg-slate-800">
        {colorImage ? (
          <Image
            key={colorImage}
            src={colorImage}
            alt={`${name} — ${selectedColor}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-all duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <span className="text-5xl font-black text-white/10 select-none">MATSIDE</span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.compare_at_price_twd && product.compare_at_price_twd > product.price_twd && (
            <Badge className="bg-red-500 text-white border-red-500 font-bold">
              {Math.round((1 - product.price_twd / product.compare_at_price_twd) * 100)}% OFF
            </Badge>
          )}
          {product.is_preorder && (
            <Badge variant="preorder">{t("shop.preorderBadge")}</Badge>
          )}
          {!inStock && !product.is_preorder && (
            <Badge variant="secondary">{t("shop.outOfStock")}</Badge>
          )}
        </div>

        {/* View details overlay */}
        <Link
          href={`/shop/${product.slug}`}
          className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all duration-300 opacity-0 group-hover:opacity-100"
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
          {product.compare_at_price_twd && product.compare_at_price_twd > product.price_twd ? (
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-bold text-red-400">
                {formatTWD(product.price_twd, locale)}
              </span>
              <span className="text-sm text-white/30 line-through font-normal">
                {formatTWD(product.compare_at_price_twd, locale)}
              </span>
            </div>
          ) : minOptionPrice !== null ? (
            <p className="mt-1 text-base font-bold text-white/90">
              <span className="text-xs font-normal text-white/40 mr-1">From</span>
              {formatTWD(minOptionPrice, locale)}
            </p>
          ) : (
            <p className="mt-1 text-lg font-bold text-white/90">
              {formatTWD(product.price_twd, locale)}
            </p>
          )}
        </div>

        {/* Color swatches */}
        {colors.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {colors.map((color) => {
              const variants = product.product_variants.filter((v) => v.color === color);
              const available = product.is_preorder || variants.some((v) => v.stock_quantity > 0);
              const isSelected = selectedColor === color;
              return (
                <button
                  key={color}
                  type="button"
                  onClick={(e) => { e.preventDefault(); setSelectedColor(color); }}
                  title={color}
                  className={[
                    "relative h-6 w-6 rounded-full border-2 transition-all duration-200",
                    isSelected ? "border-white scale-110 shadow-lg shadow-white/20" : "border-white/20 hover:border-white/50",
                    !available ? "opacity-40" : "",
                  ].join(" ")}
                  style={{ backgroundColor: colorToCss(color) }}
                >
                  {/* White/light colors need inner ring to be visible */}
                  {color === "white" && (
                    <span className="absolute inset-0.5 rounded-full border border-slate-400/30" />
                  )}
                </button>
              );
            })}
            <span className="text-xs text-white/40 capitalize">{selectedColor}</span>
          </div>
        )}

        {/* View details link */}
        <Link
          href={`/shop/${product.slug}`}
          className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 py-2.5 text-sm font-medium text-white/70 transition-all hover:border-white/50 hover:text-white"
        >
          {t("shop.viewDetails")}
        </Link>
      </div>
    </motion.div>
  );
}
