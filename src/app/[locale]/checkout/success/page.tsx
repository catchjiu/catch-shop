import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { SuccessClient } from "./SuccessClient";
import { Link } from "@/i18n/navigation";
import { CheckCircle } from "lucide-react";

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ orderId?: string; ref?: string }>;
}) {
  const { locale } = await params;
  const { orderId, ref } = await searchParams;
  const t = await getTranslations({ locale, namespace: "success" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  type OrderRow = {
    id: string;
    total_amount: number;
    status: string;
    payment_method: string;
    is_preorder_order: boolean;
    shipping_email: string | null;
    guest_email: string | null;
    created_at: string;
  };

  let order: OrderRow | null = null;
  if (orderId) {
    const { data } = await supabase
      .from("orders")
      .select("id, total_amount, status, payment_method, is_preorder_order, shipping_email, guest_email, created_at")
      .eq("id", orderId)
      .single();
    order = data as OrderRow | null;
  }

  const isGuest = !user && (order?.guest_email ?? order?.shipping_email);

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/shop"
            className="text-sm text-white/50 hover:text-white transition-colors"
          >
            CATCH BJJ
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-400" />
          <h1 className="mt-4 text-3xl font-black text-white">{t("title")}</h1>
          <p className="mt-2 text-white/60">{t("subtitle")}</p>
        </div>

        {order && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-white/50">{t("orderNumber")}</span>
              <span className="font-mono text-white/80 text-xs">{order.id.slice(0, 8).toUpperCase()}…</span>
            </div>
          </div>
        )}

        <Suspense>
          <SuccessClient
            order={order}
            isGuest={Boolean(isGuest)}
            guestEmail={order?.guest_email ?? order?.shipping_email ?? ""}
            locale={locale}
          />
        </Suspense>

        <div className="mt-8 text-center">
          <Link
            href="/shop"
            className="text-sm text-white/50 hover:text-white transition-colors underline underline-offset-4"
          >
            {t("continueShopping")}
          </Link>
        </div>
      </main>
    </div>
  );
}
