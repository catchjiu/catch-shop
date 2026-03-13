import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ProductCard } from "./ProductCard";
import type { ProductWithVariants } from "@/lib/supabase/types";

export async function ProductGrid() {
  const supabase = await createClient();
  const t = await getTranslations("shop");

  const { data: products, error } = await supabase
    .from("products")
    .select("*, product_variants(*)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error || !products || products.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-400 text-lg">{t("noProducts")}</p>
      </div>
    );
  }

  const allProducts = products as ProductWithVariants[];
  const saleProducts = allProducts.filter(
    (p) => p.compare_at_price_twd && p.compare_at_price_twd > p.price_twd
  );
  const regularProducts = allProducts.filter(
    (p) => !p.compare_at_price_twd || p.compare_at_price_twd <= p.price_twd
  );

  return (
    <div className="space-y-14">
      {/* ── Sale section ─────────────────────────────────────────── */}
      {saleProducts.length > 0 && (
        <section>
          <div className="mb-6 flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-red-500 px-3 py-1 text-sm font-black text-white tracking-wide">
                {t("saleBadge")}
              </span>
              <h2 className="text-xl font-black text-white">{t("saleTitle")}</h2>
            </div>
            <div className="flex-1 h-px bg-red-500/20" />
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {saleProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        </section>
      )}

      {/* ── All products ─────────────────────────────────────────── */}
      <section>
        {saleProducts.length > 0 && (
          <div className="mb-6 flex items-center gap-4">
            <h2 className="text-xl font-black text-white">{t("allProductsTitle")}</h2>
            <div className="flex-1 h-px bg-white/10" />
          </div>
        )}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {regularProducts.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
        </div>
      </section>
    </div>
  );
}
