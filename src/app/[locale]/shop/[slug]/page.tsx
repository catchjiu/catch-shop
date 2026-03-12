import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { formatTWD } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Clock } from "lucide-react";
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

  const p = product as ProductWithVariants;
  const name = locale === "zh-TW" ? p.name_zh : p.name_en;
  const description = locale === "zh-TW" ? p.description_zh : p.description_en;
  const preorderNote = locale === "zh-TW" ? p.preorder_note_zh : p.preorder_note_en;

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

        <div className="grid gap-12 lg:grid-cols-2">
          {/* Image */}
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-800">
            {p.base_image_url ? (
              <Image
                src={p.base_image_url}
                alt={name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                <span className="text-8xl font-black text-white/5 select-none">BJJ</span>
              </div>
            )}
            {p.is_preorder && (
              <div className="absolute top-4 left-4">
                <Badge variant="preorder">{t("preorderBadge")}</Badge>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-3xl font-black text-white sm:text-4xl">{name}</h1>
              <p className="mt-2 text-3xl font-bold text-white/90">
                {formatTWD(p.price_twd, locale)}
              </p>
            </div>

            {p.is_preorder && preorderNote && (
              <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
                <p className="text-sm text-amber-300">{preorderNote}</p>
              </div>
            )}

            {description && (
              <>
                <Separator className="bg-white/10" />
                <p className="text-white/60 leading-relaxed">{description}</p>
              </>
            )}

            <Separator className="bg-white/10" />

            {/* Client-side add to cart with size selection */}
            <ProductDetailClient product={p} locale={locale} />
          </div>
        </div>
      </main>
    </ShopClientWrapper>
  );
}
