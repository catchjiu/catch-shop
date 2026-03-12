import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { ProductDetailClient } from "./ProductDetailClient";
import { ShopClientWrapper } from "../ShopClientWrapper";
import type { ProductWithVariants } from "@/lib/supabase/types";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "shop" });
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("*, product_variants(*)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!product) notFound();

  return (
    <ShopClientWrapper>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/shop"
          className="mb-8 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToShop")}
        </Link>

        <ProductDetailClient
          product={product as ProductWithVariants}
          locale={locale}
        />
      </main>
    </ShopClientWrapper>
  );
}
