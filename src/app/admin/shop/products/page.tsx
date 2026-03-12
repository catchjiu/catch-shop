import { createServiceClient } from "@/lib/supabase/server";
import { ProductsClient } from "./ProductsClient";

export const metadata = { title: "Products — Matside Admin" };
export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const supabase = createServiceClient();

  const { data: products } = await supabase
    .from("products")
    .select("*, product_variants(*)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Products</h1>
        <p className="mt-1 text-sm text-white/40">
          Add, edit, and manage your product catalogue and variants.
        </p>
      </div>
      <ProductsClient products={(products ?? []) as Parameters<typeof ProductsClient>[0]["products"]} />
    </div>
  );
}
