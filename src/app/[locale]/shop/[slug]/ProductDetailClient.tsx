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
import type { ProductWithVariants, ProductOptionGroup, SelectedOption } from "@/lib/supabase/types";

// ── Size groupings ────────────────────────────────────────────────────────────
const YOUTH_SIZES   = ["Y-XS", "Y-S", "Y-M", "Y-L"];
const ADULT_SIZES   = ["XS", "S", "M", "L", "XL", "XXL"];
const GI_ADULT_M    = ["A0", "A1", "A1L", "A2", "A3", "A4"];
const GI_KIDS       = ["M000", "M00", "M0", "M1", "M2", "M3"];
const GI_FEMALE     = ["F1", "F2", "F3"];

function detectSizeType(sizes: string[]): "gi" | "nogi" | "plain" {
  const s = sizes.map((x) => x.toUpperCase());
  // Gi: A0–A4, F1–F3, M000/M00/M0/M1/M2/M3 — all require a digit directly after the letter
  // Note: plain "M" (Medium) must NOT match → require at least one char after M
  if (s.some((x) => /^(A\d|F\d|M[0-9])/.test(x))) return "gi";
  if (s.some((x) => x.startsWith("Y-"))) return "nogi";
  return "plain";
}

function buildSizeGroups(
  sizes: string[],
  type: "gi" | "nogi" | "plain",
  locale: string
): { label: string; sizes: string[] }[] {
  // Case-insensitive match: return the actual stored value (preserving original case)
  const match = (predefined: string[]) =>
    predefined
      .map((p) => sizes.find((s) => s.toUpperCase() === p.toUpperCase()))
      .filter((s): s is string => s !== undefined);

  if (type === "gi") {
    return [
      { label: locale === "zh-TW" ? "成人男裝" : "Adult Male", sizes: match(GI_ADULT_M) },
      { label: locale === "zh-TW" ? "兒童"     : "Kids",        sizes: match(GI_KIDS)   },
      { label: locale === "zh-TW" ? "女裝"     : "Female",      sizes: match(GI_FEMALE) },
    ].filter((g) => g.sizes.length > 0);
  }
  if (type === "nogi") {
    // Sizes that belong to a known group
    const known = [...YOUTH_SIZES, ...ADULT_SIZES].map((p) => p.toUpperCase());
    const extra = sizes.filter((s) => !known.includes(s.toUpperCase()));
    const groups = [
      { label: locale === "zh-TW" ? "青少年" : "Youth", sizes: match(YOUTH_SIZES) },
      { label: locale === "zh-TW" ? "成人"   : "Adult", sizes: match(ADULT_SIZES) },
    ].filter((g) => g.sizes.length > 0);
    // Unrecognised sizes shown in their own flat group
    if (extra.length > 0) groups.push({ label: "", sizes: extra });
    return groups;
  }
  // plain — single unnamed group, preserving database order
  return [{ label: "", sizes }];
}
// ─────────────────────────────────────────────────────────────────────────────

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

  // Product options (e.g. "Item": Rash Guard / Shorts / Both)
  const optionGroups: ProductOptionGroup[] = (product.options ?? []) as ProductOptionGroup[];

  // For absolute-price groups, compute the effective price addition vs the variant/base price.
  // Accepts an explicit priceOverride so it can be called before selectedVariant is defined.
  const getChoicePriceAdd = (
    group: ProductOptionGroup,
    choice: { label: string; priceAdd: number; price?: number },
    priceOverride?: number | null,
  ) => {
    if (group.useAbsolutePrice) {
      const base = priceOverride ?? product.price_twd;
      return (choice.price ?? 0) - base;
    }
    return choice.priceAdd;
  };

  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>(() => {
    // At initialisation selectedVariant doesn't exist yet — use the first variant's price_override
    const firstVariant = product.product_variants.find((v) => v.color === colors[0]);
    return optionGroups.map((g) => ({
      name: g.name,
      choice: g.choices[0]?.label ?? "",
      priceAdd: getChoicePriceAdd(g, g.choices[0] ?? { label: "", priceAdd: 0, price: 0 }, firstVariant?.price_override),
    }));
  });
  const optionsPriceAdd = selectedOptions.reduce((sum, o) => sum + (o.priceAdd ?? 0), 0);

  const handleOptionChange = (groupName: string, choiceLabel: string, priceAdd: number) => {
    setSelectedOptions((prev) =>
      prev.map((o) => o.name === groupName ? { ...o, choice: choiceLabel, priceAdd } : o)
    );
  };

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

  // Effective base price: use variant override if set, otherwise product base price
  const effectiveBasePrice = selectedVariant?.price_override ?? product.price_twd;

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
      price: effectiveBasePrice + optionsPriceAdd,
      isPreorder: product.is_preorder,
      selectedOptions,
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
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {product.compare_at_price_twd && product.compare_at_price_twd > product.price_twd && (
            <Badge className="bg-red-500 text-white border-red-500 font-bold text-sm px-2 py-1">
              {Math.round((1 - product.price_twd / product.compare_at_price_twd) * 100)}% OFF
            </Badge>
          )}
          {product.is_preorder && (
            <Badge variant="preorder">{t("preorderBadge")}</Badge>
          )}
        </div>
      </div>

      {/* ── Details ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-black text-white sm:text-4xl">{name}</h1>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <span className={[
              "text-3xl font-bold",
              product.compare_at_price_twd && product.compare_at_price_twd > effectiveBasePrice
                ? "text-red-400"
                : "text-white/90",
            ].join(" ")}>
              {formatTWD(effectiveBasePrice + optionsPriceAdd, locale)}
            </span>
            {product.compare_at_price_twd && product.compare_at_price_twd > effectiveBasePrice && (
              <>
                <span className="text-xl text-white/30 line-through font-normal">
                  {formatTWD(product.compare_at_price_twd + optionsPriceAdd, locale)}
                </span>
                <span className="rounded bg-red-500 px-2 py-0.5 text-sm font-bold text-white">
                  {Math.round((1 - effectiveBasePrice / product.compare_at_price_twd) * 100)}% OFF
                </span>
              </>
            )}
            {optionsPriceAdd > 0 && !(product.compare_at_price_twd && product.compare_at_price_twd > effectiveBasePrice) && (
              <span className="text-xl text-white/40 line-through font-normal">
                {formatTWD(effectiveBasePrice, locale)}
              </span>
            )}
            {selectedVariant?.price_override && selectedVariant.price_override !== product.price_twd && (
              <span className="text-sm text-white/30">
                ({locale === "zh-TW" ? "此尺寸" : "this size"})
              </span>
            )}
          </div>
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

        {/* Size selector — grouped */}
        {sizesForColor.length > 0 && (() => {
          const sizeType = detectSizeType(sizesForColor);
          const groups = buildSizeGroups(sizesForColor, sizeType, locale);
          return (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-white/70">
                {t("selectSize")}
              </label>
              {groups.map((group) => (
                <div key={group.label}>
                  {group.label && (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/35">
                      {group.label}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {group.sizes.map((size) => {
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
                </div>
              ))}
              {lowStock && (
                <p className="text-sm text-amber-400">
                  {t("lowStock", { count: selectedVariant?.stock_quantity })}
                </p>
              )}
            </div>
          );
        })()}

        {/* Product option selectors (e.g. Item: Rash Guard / Shorts / Both) */}
        {optionGroups.length > 0 && (
          <div className="space-y-4">
            {optionGroups.map((group) => {
              const current = selectedOptions.find((o) => o.name === group.name);
              return (
                <div key={group.name}>
                  <label className="mb-3 block text-sm font-medium text-white/70">
                    {group.name}
                    {current && (
                      <span className="ml-2 text-white font-semibold">{current.choice}</span>
                    )}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {group.choices.map((choice) => {
                      const isSelected = current?.choice === choice.label;
                      const choicePriceAdd = getChoicePriceAdd(group, choice, selectedVariant?.price_override);
                      return (
                        <button
                          key={choice.label}
                          onClick={() => handleOptionChange(group.name, choice.label, choicePriceAdd)}
                          className={[
                            "flex flex-col items-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-all",
                            isSelected
                              ? "border-white bg-white text-slate-900"
                              : "border-white/20 text-white/70 hover:border-white/50 hover:text-white",
                          ].join(" ")}
                        >
                          <span>{choice.label}</span>
                          {group.useAbsolutePrice ? (
                            <span className={`text-xs font-bold ${isSelected ? "text-slate-600" : "text-white/50"}`}>
                              {formatTWD(choice.price ?? 0, locale)}
                            </span>
                          ) : (
                            choice.priceAdd > 0 && (
                              <span className={`text-xs ${isSelected ? "text-slate-600" : "text-white/40"}`}>
                                +{formatTWD(choice.priceAdd, locale)}
                              </span>
                            )
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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
