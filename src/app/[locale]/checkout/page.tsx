import { getTranslations } from "next-intl/server";
import { CheckoutStepper } from "@/components/shop/CheckoutStepper";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("title") };
}

export default async function CheckoutPage() {
  const t = await getTranslations("checkout");

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/shop"
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            CATCH BJJ
          </Link>
          <h1 className="mx-auto text-sm font-semibold text-white/70">
            {t("title")}
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <CheckoutStepper />
      </main>
    </div>
  );
}
