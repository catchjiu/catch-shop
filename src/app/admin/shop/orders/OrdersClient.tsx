"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Package, Truck, CheckCircle, XCircle, AlertCircle, ChevronDown } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { formatTWD } from "@/lib/currency";
import { toast } from "sonner";
import type { OrderStatus } from "@/lib/supabase/types";

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
  guest_email: string | null;
  user_id: string | null;
}

const STATUS_OPTIONS: OrderStatus[] = [
  "pending_payment",
  "processing",
  "shipped",
  "ready_for_pickup",
  "completed",
  "cancelled",
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

interface OrdersClientProps {
  orders: Order[];
  currentFilter: string;
}

// ─── Shared status selector ───────────────────────────────────────────────────

function StatusSelect({
  order,
  onStatusChange,
  disabled,
  fullWidth = false,
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

// ─── Main component ───────────────────────────────────────────────────────────

export function OrdersClient({ orders: initialOrders, currentFilter }: OrdersClientProps) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    const supabase = createClient();
    startTransition(async () => {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) {
        toast.error("Failed to update order status");
        return;
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      toast.success(`Order updated to "${STATUS_LABELS[newStatus]}"`);
    });
  };

  const handleFilterChange = (value: string) => {
    router.push(`/admin/shop/orders?filter=${value}`);
  };

  return (
    <Tabs value={currentFilter} onValueChange={handleFilterChange}>
      <TabsList className="bg-white/5 border border-white/10">
        <TabsTrigger value="all" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">
          All Orders
        </TabsTrigger>
        <TabsTrigger value="preorder" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">
          Preorder
        </TabsTrigger>
        <TabsTrigger value="pending" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">
          Pending
        </TabsTrigger>
        <TabsTrigger value="completed" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">
          Completed
        </TabsTrigger>
      </TabsList>

      <TabsContent value={currentFilter} className="mt-4">
        <div className="rounded-xl border border-white/10 overflow-hidden">

          {orders.length === 0 && (
            <div className="py-16 text-center text-white/30">No orders found.</div>
          )}

          {orders.length > 0 && (
            <>
              {/* ── Mobile card list (< md) ──────────────────────────── */}
              <div className="divide-y divide-white/5 md:hidden">
                {orders.map((order) => (
                  <div key={order.id} className="p-4 space-y-3">

                    {/* Top row: ID + date + amount */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs font-semibold text-white/70">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-white/30 mt-0.5">
                          {new Date(order.created_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-white">
                        {formatTWD(order.total_amount, "en")}
                      </p>
                    </div>

                    {/* Customer */}
                    <div>
                      <p className="text-sm font-medium text-white/80">{order.shipping_name}</p>
                      <p className="text-xs text-white/40">{order.shipping_email}</p>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        {!order.user_id && (
                          <span className="text-[10px] text-white/30 border border-white/10 rounded-full px-2 py-0.5">
                            Guest
                          </span>
                        )}
                        {order.is_preorder_order && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] text-amber-400">
                            <AlertCircle className="h-2.5 w-2.5" /> Preorder
                          </span>
                        )}
                        <span className="text-[10px] text-white/30 capitalize">
                          {order.payment_method.replace(/_/g, " ")}
                          {order.payment_ref?.startsWith("bank_last5:") && (
                            <span className="ml-1 font-mono text-white/50">
                              …{order.payment_ref.replace("bank_last5:", "")}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Status selector — full width on mobile */}
                    <StatusSelect
                      order={order}
                      onStatusChange={handleStatusChange}
                      disabled={isPending}
                      fullWidth
                    />
                  </div>
                ))}
              </div>

              {/* ── Desktop table (md+) ──────────────────────────────── */}
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
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-white/60">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-white/30 mt-0.5">
                          {new Date(order.created_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white/80">{order.shipping_name}</p>
                        <p className="text-xs text-white/40">{order.shipping_email}</p>
                        {!order.user_id && (
                          <span className="text-xs text-white/30">Guest</span>
                        )}
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
                      <td className="px-4 py-3">
                        <StatusSelect
                          order={order}
                          onStatusChange={handleStatusChange}
                          disabled={isPending}
                        />
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
  );
}
