"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Package, Save, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Variant {
  id: string;
  size: string;
  color: string;
  stock_quantity: number;
  sku: string | null;
  products: {
    id: string;
    name_en: string;
    slug: string;
    base_image_url: string | null;
  } | null;
}

interface InventoryTableProps {
  variants: Variant[];
}

export function InventoryTable({ variants: initialVariants }: InventoryTableProps) {
  const [variants, setVariants] = useState(initialVariants);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [isPending, startTransition] = useTransition();

  const startEdit = (variant: Variant) => {
    setEditingId(variant.id);
    setEditValue(variant.stock_quantity);
  };

  const saveEdit = (variantId: string) => {
    const supabase = createClient();
    startTransition(async () => {
      const { error } = await supabase
        .from("product_variants")
        .update({ stock_quantity: editValue })
        .eq("id", variantId);

      if (error) {
        toast.error("Failed to update stock");
        return;
      }

      setVariants((prev) =>
        prev.map((v) =>
          v.id === variantId ? { ...v, stock_quantity: editValue } : v
        )
      );
      setEditingId(null);
      toast.success("Stock updated");
    });
  };

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className="px-4 py-3 text-left font-medium text-white/50">Product</th>
            <th className="px-4 py-3 text-left font-medium text-white/50">SKU</th>
            <th className="px-4 py-3 text-left font-medium text-white/50">Size</th>
            <th className="px-4 py-3 text-left font-medium text-white/50">Color</th>
            <th className="px-4 py-3 text-center font-medium text-white/50">Stock</th>
            <th className="px-4 py-3 text-right font-medium text-white/50">Actions</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((variant) => {
            const isLow = variant.stock_quantity < 5;
            const isOut = variant.stock_quantity === 0;
            const isEditing = editingId === variant.id;

            return (
              <tr
                key={variant.id}
                className={[
                  "border-b border-white/5 transition-colors hover:bg-white/[0.02]",
                  isOut ? "bg-red-950/30" : isLow ? "bg-red-950/20" : "",
                ].join(" ")}
              >
                {/* Product */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-slate-800">
                      {variant.products?.base_image_url ? (
                        <Image
                          src={variant.products.base_image_url}
                          alt={variant.products.name_en}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-4 w-4 text-white/20" />
                        </div>
                      )}
                    </div>
                    <span className="font-medium text-white line-clamp-1 max-w-[200px]">
                      {variant.products?.name_en ?? "—"}
                    </span>
                  </div>
                </td>

                {/* SKU */}
                <td className="px-4 py-3 font-mono text-xs text-white/40">
                  {variant.sku ?? "—"}
                </td>

                {/* Size */}
                <td className="px-4 py-3 text-white/80">{variant.size}</td>

                {/* Color */}
                <td className="px-4 py-3 text-white/60 capitalize">{variant.color}</td>

                {/* Stock */}
                <td className="px-4 py-3 text-center">
                  {isEditing ? (
                    <Input
                      type="number"
                      min={0}
                      value={editValue}
                      onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(variant.id)}
                      className="h-7 w-20 border-white/20 bg-white/5 text-center text-white mx-auto"
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
                      {(isLow || isOut) && (
                        <AlertTriangle
                          className={`h-3.5 w-3.5 ${isOut ? "text-red-400" : "text-amber-400"}`}
                        />
                      )}
                      <span
                        className={
                          isOut
                            ? "font-bold text-red-400"
                            : isLow
                            ? "font-bold text-amber-400"
                            : "text-white"
                        }
                      >
                        {variant.stock_quantity}
                      </span>
                    </div>
                  )}
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  {isEditing ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveEdit(variant.id)}
                        disabled={isPending}
                        className="h-7 bg-white text-slate-900 hover:bg-white/90 text-xs"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                        className="h-7 text-white/50 hover:text-white text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(variant)}
                      className="h-7 text-white/40 hover:text-white text-xs"
                    >
                      Edit
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {variants.length === 0 && (
        <div className="py-16 text-center text-white/30">
          No variants found. Add products in the Supabase dashboard.
        </div>
      )}
    </div>
  );
}
