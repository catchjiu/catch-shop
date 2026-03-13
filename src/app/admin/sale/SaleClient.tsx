"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Package, Tag, X, Check, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface SaleProduct {
  id: string;
  name_en: string;
  name_zh: string;
  slug: string;
  price_twd: number;
  compare_at_price_twd: number | null;
  base_image_url: string | null;
  is_active: boolean;
}

interface SaleClientProps {
  products: SaleProduct[];
}

function discountPct(sale: number, original: number) {
  return Math.round((1 - sale / original) * 100);
}

function PriceEditor({
  product,
  onSaved,
}: {
  product: SaleProduct;
  onSaved: (updated: SaleProduct) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [salePrice, setSalePrice] = useState(String(product.price_twd));
  const [origPrice, setOrigPrice] = useState(
    product.compare_at_price_twd ? String(product.compare_at_price_twd) : ""
  );

  const salePriceNum = parseInt(salePrice) || 0;
  const origPriceNum = parseInt(origPrice) || 0;
  const isOnSale = origPriceNum > salePriceNum && salePriceNum > 0;

  const handleSave = () => {
    if (!salePriceNum || salePriceNum <= 0) {
      toast.error("Sale price must be a positive number.");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("products")
        .update({
          price_twd: salePriceNum,
          compare_at_price_twd: origPriceNum > 0 ? origPriceNum : null,
        })
        .eq("id", product.id);

      if (error) {
        toast.error("Failed to save: " + error.message);
        return;
      }
      toast.success("Prices updated.");
      onSaved({
        ...product,
        price_twd: salePriceNum,
        compare_at_price_twd: origPriceNum > 0 ? origPriceNum : null,
      });
    });
  };

  const handleRemoveSale = () => {
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("products")
        .update({ compare_at_price_twd: null })
        .eq("id", product.id);

      if (error) {
        toast.error("Failed: " + error.message);
        return;
      }
      toast.success("Sale removed.");
      onSaved({ ...product, compare_at_price_twd: null });
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-white/40">Sale Price (NT$)</label>
          <Input
            type="number"
            min={1}
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            className="border-white/20 bg-white/5 text-white"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-white/40">Original Price (NT$)</label>
          <Input
            type="number"
            min={1}
            value={origPrice}
            onChange={(e) => setOrigPrice(e.target.value)}
            placeholder="Leave blank to remove sale"
            className="border-white/20 bg-white/5 text-white placeholder:text-white/20"
          />
        </div>
      </div>

      {isOnSale && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm">
          <span className="rounded bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">SALE</span>
          <span className="text-white/60">
            <span className="line-through text-white/30">NT$ {origPriceNum.toLocaleString()}</span>
            {" → "}
            <span className="font-semibold text-white">NT$ {salePriceNum.toLocaleString()}</span>
            <span className="ml-1.5 text-red-400 font-medium">({discountPct(salePriceNum, origPriceNum)}% off)</span>
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isPending}
          className="flex-1 bg-white text-black hover:bg-white/90"
        >
          <Check className="mr-1.5 h-3.5 w-3.5" />
          {isPending ? "Saving…" : "Save Prices"}
        </Button>
        {product.compare_at_price_twd && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRemoveSale}
            disabled={isPending}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
          >
            <X className="mr-1 h-3.5 w-3.5" /> Remove Sale
          </Button>
        )}
      </div>
    </div>
  );
}

export function SaleClient({ products: initialProducts }: SaleClientProps) {
  const [products, setProducts] = useState<SaleProduct[]>(initialProducts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "on_sale" | "not_on_sale">("all");

  const onSaleProducts = products.filter(
    (p) => p.compare_at_price_twd && p.compare_at_price_twd > p.price_twd
  );
  const notOnSaleProducts = products.filter(
    (p) => !p.compare_at_price_twd || p.compare_at_price_twd <= p.price_twd
  );

  const displayProducts =
    filter === "on_sale"
      ? onSaleProducts
      : filter === "not_on_sale"
      ? notOnSaleProducts
      : products;

  const handleSaved = (updated: SaleProduct) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-white">Sale Management</h1>
        <p className="text-sm text-white/40">
          Set sale prices and original prices for products. Products with an original price higher
          than the sale price will display a sale badge on the shop.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-2xl font-black text-white">{products.length}</p>
          <p className="text-xs text-white/40 mt-0.5">Total Products</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center">
          <p className="text-2xl font-black text-red-400">{onSaleProducts.length}</p>
          <p className="text-xs text-white/40 mt-0.5">On Sale</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-2xl font-black text-white">{notOnSaleProducts.length}</p>
          <p className="text-xs text-white/40 mt-0.5">Full Price</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-4">
        {(["all", "on_sale", "not_on_sale"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              filter === f
                ? "bg-white text-black"
                : "text-white/50 hover:text-white hover:bg-white/10",
            ].join(" ")}
          >
            {f === "all" ? "All" : f === "on_sale" ? "On Sale" : "Full Price"}
          </button>
        ))}
      </div>

      {/* Product list */}
      <div className="space-y-3">
        {displayProducts.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/40">
            <Tag className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p>No products in this category.</p>
          </div>
        )}
        {displayProducts.map((product) => {
          const isOnSale =
            product.compare_at_price_twd &&
            product.compare_at_price_twd > product.price_twd;
          const isEditing = editingId === product.id;

          return (
            <div
              key={product.id}
              className="rounded-xl border border-white/10 bg-white/5 overflow-hidden"
            >
              {/* Product row */}
              <div className="flex items-center gap-4 p-4">
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-slate-800">
                  {product.base_image_url ? (
                    <Image
                      src={product.base_image_url}
                      alt={product.name_en}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package className="h-5 w-5 text-white/20" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white truncate">{product.name_en}</p>
                    {isOnSale && (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/20 text-[10px] px-1.5">
                        {discountPct(product.price_twd, product.compare_at_price_twd!)}% OFF
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    {isOnSale ? (
                      <>
                        <span className="text-sm font-bold text-red-400">
                          NT$ {product.price_twd.toLocaleString()}
                        </span>
                        <span className="text-xs text-white/30 line-through">
                          NT$ {product.compare_at_price_twd!.toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-white/60">
                        NT$ {product.price_twd.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setEditingId(isEditing ? null : product.id)}
                  className={[
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    isEditing
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                >
                  {isEditing ? (
                    <><X className="h-3.5 w-3.5" /> Cancel</>
                  ) : (
                    <><Pencil className="h-3.5 w-3.5" /> Edit</>
                  )}
                </button>
              </div>

              {/* Inline editor */}
              {isEditing && (
                <div className="border-t border-white/10 p-4 bg-black/20">
                  <PriceEditor
                    product={product}
                    onSaved={(updated) => {
                      handleSaved(updated);
                      setEditingId(null);
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
