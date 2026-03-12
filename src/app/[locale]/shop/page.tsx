import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { ShopClientWrapper } from "./ShopClientWrapper";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shop" });
  return { title: t("title") };
}

export default async function ShopPage() {
  const t = await getTranslations("shop");

  return (
    <ShopClientWrapper>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-lg text-white/50">{t("subtitle")}</p>
        </div>

        {/* Products */}
        <Suspense
          fallback={
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse rounded-2xl bg-white/5"
                />
              ))}
            </div>
          }
        >
          <ProductGrid />
        </Suspense>
      </main>
    </ShopClientWrapper>
  );
}
