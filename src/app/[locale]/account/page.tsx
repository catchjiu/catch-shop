"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AcademySelect } from "@/components/shop/AcademySelect";
import { ShopClientWrapper } from "@/app/[locale]/shop/ShopClientWrapper";
import { formatTWD } from "@/lib/currency";
import {
  User, Package, Save, LogOut, Loader2, ChevronRight,
  X, CreditCard, Building2, MapPin, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface Order {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  is_preorder_order: boolean;
  payment_method: string;
  payment_ref: string | null;
}

interface OrderItem {
  id: string;
  quantity: number;
  price_at_purchase: number;
  product_variants: {
    size: string;
    color: string;
    products: {
      name_en: string;
      name_zh: string;
    } | null;
  } | null;
}

interface OrderDetail extends Order {
  shipping_name: string;
  shipping_email: string;
  shipping_phone: string | null;
  shipping_address: string;
  shipping_city: string;
  shipping_zip: string | null;
  shipping_country: string;
  order_items: OrderItem[];
}

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  processing: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  shipped: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  ready_for_pickup: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  completed: "text-green-400 bg-green-400/10 border-green-400/20",
  cancelled: "text-red-400 bg-red-400/10 border-red-400/20",
};

export default function AccountPage() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("account");
  const tAuth = useTranslations("auth");
  const tNav = useTranslations("nav");
  const tAdmin = useTranslations("admin");

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"orders" | "profile">("orders");

  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [academy, setAcademy] = useState("");
  const [lineId, setLineId] = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push(`/${locale}/auth/login`); return; }
      setUser(user);

      const meta = user.user_metadata ?? {};
      setFullName(meta.full_name ?? "");
      setPhone(meta.phone ?? "");
      setAddress(meta.address ?? "");
      setCity(meta.city ?? "");
      setZip(meta.zip ?? "");
      setAcademy(meta.academy ?? "");
      setLineId(meta.line_id ?? "");

      const { data } = await supabase
        .from("orders")
        .select("id, created_at, total_amount, status, is_preorder_order, payment_method, payment_ref")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setOrders((data ?? []) as Order[]);
      setLoading(false);
    };
    load();
  }, [locale, router]);

  const openOrder = async (orderId: string) => {
    setDetailLoading(true);
    setSelectedOrder(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, created_at, total_amount, status, is_preorder_order,
        payment_method, payment_ref,
        shipping_name, shipping_email, shipping_phone,
        shipping_address, shipping_city, shipping_zip, shipping_country,
        order_items (
          id, quantity, price_at_purchase,
          product_variants (
            size, color,
            products ( name_en, name_zh )
          )
        )
      `)
      .eq("id", orderId)
      .single();

    if (error || !data) {
      toast.error(t("genericError"));
    } else {
      setSelectedOrder(data as unknown as OrderDetail);
    }
    setDetailLoading(false);
  };

  const handleCancel = async () => {
    if (!selectedOrder) return;
    if (!window.confirm(t("cancelConfirm"))) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/cancel`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? t("cancelError"));
        return;
      }
      toast.success(t("cancelSuccess"));
      // Update local state
      setOrders((prev) =>
        prev.map((o) => o.id === selectedOrder.id ? { ...o, status: "cancelled" } : o)
      );
      setSelectedOrder((prev) => prev ? { ...prev, status: "cancelled" } : null);
    } catch {
      toast.error(t("cancelError"));
    } finally {
      setCancelling(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName, phone, address, city, zip, country: "TW", academy: academy || null, line_id: lineId || null },
      });
      if (error) { toast.error(t("profileError")); return; }
      toast.success(t("profileSaved"));
    } catch { toast.error(t("genericError")); }
    finally { setSaving(false); }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}/shop`);
    router.refresh();
  };

  const getProductName = (item: OrderItem) => {
    const p = item.product_variants?.products;
    if (!p) return "Product";
    return locale === "zh-TW" ? p.name_zh : p.name_en;
  };

  const bankLastFive = selectedOrder?.payment_ref?.startsWith("bank_last5:")
    ? selectedOrder.payment_ref.replace("bank_last5:", "")
    : null;

  if (loading) {
    return (
      <ShopClientWrapper>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/30" />
        </div>
      </ShopClientWrapper>
    );
  }

  return (
    <ShopClientWrapper>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
            <p className="mt-0.5 text-sm text-white/40">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/40 hover:border-white/20 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>{tNav("signOut")}</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          {(["orders", "profile"] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={[
                "flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
                tab === tabKey ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70",
              ].join(" ")}
            >
              {tabKey === "orders" ? <Package className="h-4 w-4" /> : <User className="h-4 w-4" />}
              {t(tabKey)}
            </button>
          ))}
        </div>

        {/* Orders tab */}
        {tab === "orders" && (
          <div className="space-y-3">
            {orders.length === 0 ? (
              <div className="rounded-2xl border border-white/10 py-16 text-center">
                <Package className="mx-auto h-10 w-10 text-white/20" />
                <p className="mt-3 text-sm text-white/30">{t("noOrders")}</p>
                <Link href="/shop" className="mt-4 inline-block text-sm text-white underline underline-offset-2">
                  {t("startShopping")}
                </Link>
              </div>
            ) : (
              orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => openOrder(order.id)}
                  className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:border-white/20 hover:bg-white/8 transition-all"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-white">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-white/40">
                      {new Date(order.created_at).toLocaleDateString(locale === "zh-TW" ? "zh-TW" : "en-US", {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                      {order.is_preorder_order && (
                        <span className="ml-2 text-amber-400">{t("preorder")}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status] ?? "text-white/50 bg-white/5 border-white/10"}`}>
                      {tAdmin(`orderStatus.${order.status as keyof object}`)}
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {formatTWD(order.total_amount, locale)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-white/20" />
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Profile tab */}
        {tab === "profile" && (
          <form onSubmit={handleSaveProfile} className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">{tAuth("fullName")}</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder={tAuth("fullNamePlaceholder")}
                  className="border-white/20 bg-white/5 text-white placeholder:text-white/20" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">{tAuth("phone")}</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder={tAuth("phonePlaceholder")}
                  className="border-white/20 bg-white/5 text-white placeholder:text-white/20" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-white/50">{tAuth("address")}</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)}
                  placeholder={tAuth("addressPlaceholder")}
                  className="border-white/20 bg-white/5 text-white placeholder:text-white/20" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">{tAuth("city")}</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)}
                  placeholder={tAuth("cityPlaceholder")}
                  className="border-white/20 bg-white/5 text-white placeholder:text-white/20" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">{tAuth("zip")}</Label>
                <Input value={zip} onChange={(e) => setZip(e.target.value)}
                  placeholder={tAuth("zipPlaceholder")}
                  className="border-white/20 bg-white/5 text-white placeholder:text-white/20" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AcademySelect
                value={academy}
                onChange={setAcademy}
                label={tAuth("academy")}
                placeholder={tAuth("academyPlaceholder")}
                otherPlaceholder={tAuth("academyOtherPlaceholder")}
              />
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">{tAuth("lineId")}</Label>
                <Input
                  value={lineId}
                  onChange={(e) => setLineId(e.target.value)}
                  placeholder={tAuth("lineIdPlaceholder")}
                  className="border-white/20 bg-white/5 text-white placeholder:text-white/20"
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <Button type="submit" disabled={saving} className="bg-white font-semibold text-slate-900 hover:bg-white/90">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" />{t("saveProfile")}</>}
              </Button>
            </div>
          </form>
        )}
      </main>

      {/* Order Detail Drawer */}
      <AnimatePresence>
        {(detailLoading || selectedOrder) && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={() => !detailLoading && setSelectedOrder(null)}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-slate-900 shadow-2xl"
            >
              {detailLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white/30" />
                </div>
              ) : selectedOrder && (
                <>
                  {/* Panel header */}
                  <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                    <div>
                      <h2 className="font-bold text-white">{t("orderDetail")}</h2>
                      <p className="font-mono text-xs text-white/40">
                        #{selectedOrder.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedOrder(null)}
                      className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Scrollable body */}
                  <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                    {/* Status */}
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full border px-3 py-1 text-sm font-medium ${STATUS_COLORS[selectedOrder.status] ?? "text-white/50 bg-white/5 border-white/10"}`}>
                        {tAdmin(`orderStatus.${selectedOrder.status as keyof object}`)}
                      </span>
                      <span className="text-xs text-white/30">
                        {new Date(selectedOrder.created_at).toLocaleDateString(locale === "zh-TW" ? "zh-TW" : "en-US", {
                          year: "numeric", month: "long", day: "numeric",
                        })}
                      </span>
                    </div>

                    {/* Items */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">{t("items")}</p>
                      <div className="space-y-2">
                        {selectedOrder.order_items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2.5">
                            <div>
                              <p className="text-sm font-medium text-white">{getProductName(item)}</p>
                              <p className="text-xs text-white/40">
                                {item.product_variants?.size} · {item.product_variants?.color} × {item.quantity}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-white">
                              {formatTWD(item.price_at_purchase * item.quantity, locale)}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between border-t border-white/10 pt-2 px-1">
                          <span className="text-sm font-bold text-white">{t("total")}</span>
                          <span className="text-sm font-bold text-white">{formatTWD(selectedOrder.total_amount, locale)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Shipping */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">{t("shipping")}</p>
                      <div className="rounded-lg bg-white/5 px-3 py-3 text-sm text-white/70 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-white/30 shrink-0" />
                          <span className="font-medium text-white">{selectedOrder.shipping_name}</span>
                        </div>
                        <p className="pl-5">{selectedOrder.shipping_address}, {selectedOrder.shipping_city} {selectedOrder.shipping_zip}</p>
                        <p className="pl-5">{selectedOrder.shipping_email}</p>
                        {selectedOrder.shipping_phone && <p className="pl-5">{selectedOrder.shipping_phone}</p>}
                      </div>
                    </div>

                    {/* Payment instructions (only if pending_payment + bank transfer) */}
                    {selectedOrder.status === "pending_payment" && selectedOrder.payment_method === "manual_bank_transfer" && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">{t("paymentInstructions")}</p>
                        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-4 space-y-3">
                          <div className="flex items-center gap-2 text-amber-400">
                            <Building2 className="h-4 w-4" />
                            <span className="text-sm font-semibold">{t("bankTransfer")}</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-white/50">Bank</span>
                              <span className="text-white font-medium">{t("bankName")}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/50">Account</span>
                              <span className="font-mono text-white font-semibold tracking-wider">{t("accountNumber")}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/50">Name</span>
                              <span className="text-white">{t("accountHolder")}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/50">Amount</span>
                              <span className="text-white font-semibold">{formatTWD(selectedOrder.total_amount, locale)}</span>
                            </div>
                          </div>
                          <p className="text-xs text-amber-400/80 border-t border-amber-400/10 pt-3">
                            {t("transferNote", { orderId: "#" + selectedOrder.id.slice(0, 8).toUpperCase() })}
                          </p>
                          {bankLastFive && (
                            <p className="text-xs text-white/40">
                              {t("yourRef")}: <span className="font-mono font-semibold text-white/70">{bankLastFive}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* NewebPay pending */}
                    {selectedOrder.status === "pending_payment" && selectedOrder.payment_method === "newebpay" && (
                      <div className="rounded-xl border border-blue-400/20 bg-blue-400/5 px-4 py-4 flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-blue-400 shrink-0" />
                        <p className="text-sm text-blue-300">{t("newebpay")}</p>
                      </div>
                    )}
                  </div>

                  {/* Cancel footer (only for pending_payment) */}
                  {selectedOrder.status === "pending_payment" && (
                    <div className="border-t border-white/10 px-6 py-4">
                      <button
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                        {t("cancelOrder")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ShopClientWrapper>
  );
}
