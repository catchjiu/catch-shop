import { createClient } from "@/lib/supabase/server";
import { ProductCard } from "./ProductCard";
import type { ProductWithVariants } from "@/lib/supabase/types";

export async function ProductGrid() {
  const supabase = await createClient();

  const { data: products, error } = await supabase
    .from("products")
    .select("*, product_variants(*)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error || !products || products.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-400 text-lg">No products available.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {(products as ProductWithVariants[]).map((product, index) => (
        <ProductCard key={product.id} product={product} index={index} />
      ))}
    </div>
  );
}
