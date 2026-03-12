import { createServiceClient } from "@/lib/supabase/server";
import { InventoryTable } from "./InventoryTable";

export const metadata = { title: "Inventory — Catch BJJ Admin" };

export default async function InventoryPage() {
  const supabase = await createServiceClient();

  const { data: variants } = await supabase
    .from("product_variants")
    .select("*, products(id, name_en, slug, base_image_url)")
    .order("stock_quantity", { ascending: true });

  const lowStockCount = variants?.filter((v) => v.stock_quantity < 5).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Inventory Matrix</h1>
          <p className="mt-1 text-sm text-white/50">
            Manage stock levels by variant
          </p>
        </div>
        {lowStockCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-red-400 font-medium">
              {lowStockCount} low stock item{lowStockCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      <InventoryTable variants={variants ?? []} />
    </div>
  );
}
