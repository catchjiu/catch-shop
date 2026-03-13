"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Clock, Package, Truck, CheckCircle, XCircle, AlertCircle,
  ChevronDown, X, MapPin, CreditCard, Building2, Phone, MessageSquare,
  GraduationCap, Mail, ShoppingBag, Loader2, ChevronRight,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { formatTWD } from "@/lib/currency";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { OrderStatus } from "@/lib/supabase/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  created_at: string;
  status: OrderStatus;
  payment_method: string;
  payment_ref: string | null;
  total_amount: number;
  is_preorder_order: boolean;
  shipping_name: string;
  shipping_email: string;
  shipping_phone: string | null;
  shipping_address: string;
  shipping_city: string;
  shipping_zip: string | null;
  shipping_country: string;
  guest_email: string | null;
  user_id: string | null;
  academy: string | null;
  line_id: string | null;
}

interface SelectedOpt { name: string; choice: string; priceAdd: number; }

interface OrderItem {
  id: string;
  quantity: number;
  price_at_purchase: number;
  selected_options: SelectedOpt[] | null;
  product_variants: {
    size: string;
    color: string;
    products: { name_en: string; name_zh: string } | null;
  } | null;
}

interface OrderDetail extends Order {
  order_items: OrderItem[];
}

interface PastOrder {
  id: string;
  created_at: string;
  total_amount: number;
  status: OrderStatus;
  is_preorder_order: boolean;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_OPTIONS: OrderStatus[] = [
  "pending_payment", "processing", "shipped",
  "ready_for_pickup", "completed", "cancelled",
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Pending Payment",
  processing: "Processing",
  shipped: "Shipped",
  ready_for_pickup: "Ready for Pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_ICONS: Record<OrderStatus, React.ReactNode> = {
  pending_payment: <Clock className="h-3.5 w-3.5" />,
  processing: <Package className="h-3.5 w-3.5" />,
  shipped: <Truck className="h-3.5 w-3.5" />,
  ready_for_pickup: <Package className="h-3.5 w-3.5" />,
  completed: <CheckCircle className="h-3.5 w-3.5" />,
  cancelled: <XCircle className="h-3.5 w-3.5" />,
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending_payment: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  processing: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  shipped: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  ready_for_pickup: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  completed: "text-green-400 bg-green-400/10 border-green-400/20",
  cancelled: "text-red-400 bg-red-400/10 border-red-400/20",
};

// ─── Status selector ─────────────────────────────────────────────────────────

function StatusSelect({
  order, onStatusChange, disabled, fullWidth = false,
}: {
  order: Order;
  onStatusChange: (id: string, status: OrderStatus) => void;
  disabled: boolean;
  fullWidth?: boolean;
}) {
  return (
    <Select
      value={order.status}
      onValueChange={(v) => onStatusChange(order.id, v as OrderStatus)}
      disabled={disabled}
    >
      <SelectTrigger
        onClick={(e) => e.stopPropagation()}
        className={`h-9 border text-xs font-medium ${STATUS_COLORS[order.status]} ${fullWidth ? "w-full" : "w-44"}`}
      >
        <SelectValue>
          <span className="flex items-center gap-1.5">
            {STATUS_ICONS[order.status]}
            {STATUS_LABELS[order.status]}
          </span>
        </SelectValue>
        <ChevronDown className="h-3.5 w-3.5 opacity-50 ml-auto" />
      </SelectTrigger>
      <SelectContent className="bg-slate-900 border-white/10">
        {STATUS_OPTIONS.map((status) => (
          <SelectItem
            key={status}
            value={status}
            className="text-white/70 focus:bg-white/10 focus:text-white text-xs"
          >
            <span className="flex items-center gap-2">
              {STATUS_ICONS[status]}
              {STATUS_LABELS[status]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function OrderDetailPanel({
  order,
  onClose,
  onStatusChange,
  statusPending,
}: {
  order: OrderDetail;
  onClose: () => void;
  onStatusChange: (id: string, status: OrderStatus) => void;
  statusPending: boolean;
}) {
  const [pastOrders, setPastOrders] = useState<PastOrder[] | null>(null);
  const [loadingPast, setLoadingPast] = useState(false);

  // Load past orders lazily on first open
  useState(() => {
    const load = async () => {
      setLoadingPast(true);
      const supabase = createClient();
      const email = order.shipping_email;
      const { data } = await supabase
        .from("orders")
        .select("id, created_at, total_amount, status, is_preorder_order")
        .or(
          order.user_id
            ? `user_id.eq.${order.user_id},shipping_email.eq.${email}`
            : `shipping_email.eq.${email}`
        )
        .neq("id", order.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setPastOrders((data ?? []) as PastOrder[]);
      setLoadingPast(false);
    };
    load();
  });

  const bankLastFive = order.payment_ref?.startsWith("bank_last5:")
    ? order.payment_ref.replace("bank_last5:", "")
    : null;

  const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-white/30 shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-[10px] text-white/30 uppercase tracking-wider">{label}</p>
          <p className="text-sm text-white/80 break-all">{value}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 shrink-0">
        <div>
          <h2 className="font-bold text-white text-base">Order Details</h2>
          <p className="font-mono text-xs text-white/40">#{order.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusSelect order={order} onStatusChange={onStatusChange} disabled={statusPending} />
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

        {/* Status badge + date */}
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
            {STATUS_ICONS[order.status]}
            {STATUS_LABELS[order.status]}
          </span>
          <span className="text-xs text-white/30">
            {new Date(order.created_at).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric",
            })}
          </span>
          {order.is_preorder_order && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">
              <AlertCircle className="h-2.5 w-2.5" /> Preorder
            </span>
          )}
        </div>

        {/* Customer info */}
        <section>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">Customer</p>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 space-y-3">
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Name" value={order.shipping_name} />
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={order.shipping_email} />
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={order.shipping_phone} />
            <InfoRow icon={<MessageSquare className="h-4 w-4" />} label="LINE ID" value={order.line_id} />
            <InfoRow icon={<GraduationCap className="h-4 w-4" />} label="Academy" value={order.academy} />
            <InfoRow
              icon={<MapPin className="h-4 w-4" />}
              label="Address"
              value={`${order.shipping_address}, ${order.shipping_city}${order.shipping_zip ? " " + order.shipping_zip : ""}`}
            />
            {!order.user_id && (
              <p className="text-[10px] text-white/30 border border-white/10 rounded-full px-2 py-0.5 w-fit">Guest checkout</p>
            )}
          </div>
        </section>

        {/* Payment */}
        <section>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">Payment</p>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 space-y-2">
            <div className="flex items-center gap-2.5">
              {order.payment_method === "manual_bank_transfer"
                ? <Building2 className="h-4 w-4 text-white/30" />
                : <CreditCard className="h-4 w-4 text-white/30" />}
              <span className="text-sm text-white/80 capitalize">
                {order.payment_method.replace(/_/g, " ")}
              </span>
            </div>
            {bankLastFive && (
              <p className="text-sm text-white/60 pl-6.5">
                Bank account last 5 digits:{" "}
                <span className="font-mono font-semibold text-white">{bankLastFive}</span>
              </p>
            )}
            <div className="flex justify-between pt-1 border-t border-white/10">
              <span className="text-sm text-white/50">Total</span>
              <span className="text-sm font-bold text-white">{formatTWD(order.total_amount, "en")}</span>
            </div>
          </div>
        </section>

        {/* Items */}
        <section>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
            Items ({order.order_items.length})
          </p>
          <div className="space-y-2">
            {order.order_items.map((item) => {
              const name = item.product_variants?.products?.name_en ?? "Product";
              return (
                <div key={item.id} className="flex items-start justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="space-y-0.5 min-w-0 pr-4">
                    <p className="text-sm font-medium text-white">{name}</p>
                    <p className="text-xs text-white/40">
                      {item.product_variants?.color} / {item.product_variants?.size} × {item.quantity}
                    </p>
                    {item.selected_options && item.selected_options.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.selected_options.map((opt) => (
                          <span key={opt.name} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
                            {opt.name}: {opt.choice}
                            {opt.priceAdd > 0 && ` (+${opt.priceAdd})`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-white shrink-0">
                    {formatTWD(item.price_at_purchase * item.quantity, "en")}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Customer's other orders */}
        <section>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/30">
            Other Orders from this Customer
          </p>
          {loadingPast && (
            <div className="flex items-center gap-2 text-white/30 text-xs py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          )}
          {!loadingPast && pastOrders !== null && pastOrders.length === 0 && (
            <p className="text-xs text-white/25 italic">No other orders found.</p>
          )}
          {!loadingPast && pastOrders && pastOrders.length > 0 && (
            <div className="space-y-2">
              {pastOrders.map((po) => (
                <div
                  key={po.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5"
                >
                  <div>
                    <p className="font-mono text-xs text-white/60">#{po.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-[10px] text-white/30">
                      {new Date(po.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {po.is_preorder_order && <span className="ml-1 text-amber-400">Preorder</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[po.status]}`}>
                      {STATUS_LABELS[po.status]}
                    </span>
                    <span className="text-xs font-semibold text-white">{formatTWD(po.total_amount, "en")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OrdersClient({ orders: initialOrders, currentFilter }: OrdersClientProps) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [isPending, startTransition] = useTransition();
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    const supabase = createClient();
    startTransition(async () => {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) { toast.error("Failed to update order status"); return; }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      // Also update selected panel if it's open
      setSelectedOrder((prev) => prev?.id === orderId ? { ...prev, status: newStatus } : prev);
      toast.success(`Order updated to "${STATUS_LABELS[newStatus]}"`);
    });
  };

  const openOrder = async (orderId: string) => {
    setDetailLoading(true);
    setSelectedOrder(null);
    const supabase = createClient();

    // Try full query first; fall back to a minimal query if newer columns don't exist yet
    let data: unknown = null;
    let error: unknown = null;

    const fullSelect = `
      id, created_at, status, payment_method, payment_ref, total_amount,
      is_preorder_order, shipping_name, shipping_email, shipping_phone,
      shipping_address, shipping_city, shipping_zip, shipping_country,
      guest_email, user_id, academy, line_id,
      order_items (
        id, quantity, price_at_purchase,
        product_variants (
          size, color,
          products ( name_en, name_zh )
        )
      )
    `;

    const fallbackSelect = `
      id, created_at, status, payment_method, payment_ref, total_amount,
      is_preorder_order, shipping_name, shipping_email, shipping_phone,
      shipping_address, shipping_city, shipping_zip, shipping_country,
      guest_email, user_id,
      order_items (
        id, quantity, price_at_purchase,
        product_variants (
          size, color,
          products ( name_en, name_zh )
        )
      )
    `;

    const r1 = await supabase.from("orders").select(fullSelect).eq("id", orderId).single();
    if (r1.error) {
      // Newer columns (academy, line_id) may not exist — retry without them
      const r2 = await supabase.from("orders").select(fallbackSelect).eq("id", orderId).single();
      data = r2.data;
      error = r2.error;
    } else {
      data = r1.data;
    }

    if (error || !data) {
      toast.error("Could not load order — check browser console for details.");
      console.error("openOrder error:", error);
    } else {
      setSelectedOrder(data as unknown as OrderDetail);
    }
    setDetailLoading(false);
  };

  const handleFilterChange = (value: string) => {
    router.push(`/admin/shop/orders?filter=${value}`);
  };

  return (
    <>
      <Tabs value={currentFilter} onValueChange={handleFilterChange}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="all" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">All Orders</TabsTrigger>
          <TabsTrigger value="preorder" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">Preorder</TabsTrigger>
          <TabsTrigger value="pending" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">Pending</TabsTrigger>
          <TabsTrigger value="completed" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={currentFilter} className="mt-4">
          <div className="rounded-xl border border-white/10 overflow-hidden">
            {orders.length === 0 && (
              <div className="py-16 text-center text-white/30">No orders found.</div>
            )}

            {orders.length > 0 && (
              <>
                {/* ── Mobile cards ─────────────────────────────────────── */}
                <div className="divide-y divide-white/5 md:hidden">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="p-4 space-y-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => openOrder(order.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs font-semibold text-white/70">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="text-xs text-white/30 mt-0.5">
                            {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white">{formatTWD(order.total_amount, "en")}</p>
                          <ChevronRight className="h-4 w-4 text-white/20" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white/80">{order.shipping_name}</p>
                        <p className="text-xs text-white/40">{order.shipping_email}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {!order.user_id && (
                            <span className="text-[10px] text-white/30 border border-white/10 rounded-full px-2 py-0.5">Guest</span>
                          )}
                          {order.is_preorder_order && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] text-amber-400">
                              <AlertCircle className="h-2.5 w-2.5" /> Preorder
                            </span>
                          )}
                        </div>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <StatusSelect order={order} onStatusChange={handleStatusChange} disabled={isPending} fullWidth />
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Desktop table ─────────────────────────────────────── */}
                <table className="hidden w-full text-sm md:table">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-4 py-3 text-left font-medium text-white/50">Order</th>
                      <th className="px-4 py-3 text-left font-medium text-white/50">Customer</th>
                      <th className="px-4 py-3 text-left font-medium text-white/50">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-white/50">Payment</th>
                      <th className="px-4 py-3 text-right font-medium text-white/50">Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-white/50">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => openOrder(order.id)}
                        className="border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-white/60">#{order.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-xs text-white/30 mt-0.5">
                            {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white/80">{order.shipping_name}</p>
                          <p className="text-xs text-white/40">{order.shipping_email}</p>
                          {!order.user_id && <span className="text-xs text-white/30">Guest</span>}
                        </td>
                        <td className="px-4 py-3">
                          {order.is_preorder_order ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                              <AlertCircle className="h-3 w-3" /> Preorder
                            </span>
                          ) : (
                            <span className="text-xs text-white/30">Standard</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-white/50">
                          <span className="capitalize">{order.payment_method.replace(/_/g, " ")}</span>
                          {order.payment_ref?.startsWith("bank_last5:") && (
                            <span className="ml-1.5 font-mono text-white/70 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
                              …{order.payment_ref.replace("bank_last5:", "")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-white">
                          {formatTWD(order.total_amount, "en")}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <StatusSelect order={order} onStatusChange={handleStatusChange} disabled={isPending} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Order Detail Drawer ──────────────────────────────────────────── */}
      <AnimatePresence>
        {(detailLoading || selectedOrder) && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => !detailLoading && setSelectedOrder(null)}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-slate-900 shadow-2xl border-l border-white/10"
            >
              {detailLoading ? (
                <div className="flex flex-1 items-center justify-center gap-3 text-white/30">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Loading order…</span>
                </div>
              ) : selectedOrder ? (
                <OrderDetailPanel
                  order={selectedOrder}
                  onClose={() => setSelectedOrder(null)}
                  onStatusChange={handleStatusChange}
                  statusPending={isPending}
                />
              ) : null}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

interface OrdersClientProps {
  orders: Order[];
  currentFilter: string;
}
