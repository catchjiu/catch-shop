"use client";

import { useState } from "react";
import {
  ChevronDown, ChevronRight, Package, Mail, Phone,
  MessageSquare, GraduationCap, Building2, Clock, AlertCircle,
} from "lucide-react";
import { formatTWD } from "@/lib/currency";
import type { OrderStatus } from "@/lib/supabase/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderRow {
  orderId: string;
  orderRef: string;       // first 8 chars
  createdAt: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string;
  phone: string | null;
  lineId: string | null;
  academy: string | null;
  quantity: number;
  selectedOptions: Array<{ name: string; choice: string; priceAdd: number }> | null;
  paymentMethod: string;
  paymentRef: string | null;
}

export interface VariantSummary {
  variantId: string;
  productNameEn: string;
  productSlug: string;
  color: string;
  totalQty: number;
  orders: OrderRow[];
  // sizes inside this product+color group
  sizes: { size: string; qty: number; orders: OrderRow[] }[];
}

export interface ProductSummary {
  productId: string;
  productNameEn: string;
  productSlug: string;
  totalQty: number;
  variants: VariantSummary[];
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  processing: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  shipped: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  ready_for_pickup: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  completed: "text-green-400 bg-green-400/10 border-green-400/20",
  cancelled: "text-red-400 bg-red-400/10 border-red-400/20",
};

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending Payment",
  processing: "Processing",
  shipped: "Shipped",
  ready_for_pickup: "Ready for Pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};

// ─── Order rows inside an expanded section ────────────────────────────────────

function OrderRowCard({ row }: { row: OrderRow }) {
  const bankLastFive = row.paymentRef?.startsWith("bank_last5:")
    ? row.paymentRef.replace("bank_last5:", "")
    : null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-2">
      {/* Top row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold text-white/70">
            #{row.orderRef}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">
            {new Date(row.createdAt).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[row.status] ?? "text-white/50"}`}>
            {STATUS_LABELS[row.status] ?? row.status}
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">
            ×{row.quantity}
          </span>
        </div>
      </div>

      {/* Customer info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 pt-1 border-t border-white/5">
        <div className="flex items-center gap-1.5 text-xs text-white/60">
          <Mail className="h-3 w-3 text-white/30 shrink-0" />
          <span className="truncate">{row.customerEmail}</span>
        </div>
        {row.phone && (
          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <Phone className="h-3 w-3 text-white/30 shrink-0" />
            <span>{row.phone}</span>
          </div>
        )}
        {row.lineId && (
          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <MessageSquare className="h-3 w-3 text-white/30 shrink-0" />
            <span>{row.lineId}</span>
          </div>
        )}
        {row.academy && (
          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <GraduationCap className="h-3 w-3 text-white/30 shrink-0" />
            <span>{row.academy}</span>
          </div>
        )}
        {bankLastFive && (
          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <Building2 className="h-3 w-3 text-white/30 shrink-0" />
            <span>Bank last 5: <span className="font-mono font-semibold text-white/80">{bankLastFive}</span></span>
          </div>
        )}
      </div>

      {/* Selected options */}
      {row.selectedOptions && row.selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-white/5">
          {row.selectedOptions.map((opt) => (
            <span key={opt.name} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
              {opt.name}: {opt.choice}{opt.priceAdd > 0 ? ` (+${opt.priceAdd})` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Accordion size row ────────────────────────────────────────────────────────

function SizeRow({ size, qty, orders }: { size: string; qty: number; orders: OrderRow[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors text-left"
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-white/30 shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-white/30 shrink-0" />}
        <span className="flex-1 text-sm text-white/70 font-medium">{size}</span>
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white">
          {qty} ordered
        </span>
        <span className="text-[10px] text-white/30 ml-2">{orders.length} order{orders.length !== 1 ? "s" : ""}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2">
          {orders.map((row) => (
            <OrderRowCard key={`${row.orderId}-${row.quantity}`} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Accordion colour / variant group ─────────────────────────────────────────

function ColorGroup({ variant }: { variant: VariantSummary }) {
  const [open, setOpen] = useState(false);
  const COLOR_CSS: Record<string, string> = {
    white: "#F8F8F8", black: "#1C1C1C", blue: "#1D4ED8", navy: "#1E3A5F",
    red: "#DC2626", green: "#16A34A", yellow: "#EAB308", pink: "#EC4899",
    purple: "#9333EA", grey: "#6B7280", gray: "#6B7280", gold: "#D97706",
    silver: "#9CA3AF", orange: "#EA580C", brown: "#92400E",
  };

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
      >
        {open
          ? <ChevronDown className="h-4 w-4 text-white/30 shrink-0" />
          : <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />}
        <span
          className="h-4 w-4 rounded-full border border-white/20 shrink-0"
          style={{ backgroundColor: COLOR_CSS[variant.color.toLowerCase().trim()] ?? "#6B7280" }}
        />
        <span className="flex-1 text-sm text-white capitalize font-medium">{variant.color}</span>
        <span className="text-xs text-white/40 mr-3">
          {variant.sizes.length} size{variant.sizes.length !== 1 ? "s" : ""}
        </span>
        <span className="rounded-full bg-amber-500/15 border border-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-400">
          {variant.totalQty} total
        </span>
      </button>

      {open && (
        <div className="ml-5 border-l border-white/10 mb-2">
          {variant.sizes.map((s) => (
            <SizeRow key={s.size} size={s.size} qty={s.qty} orders={s.orders} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Product card ─────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: ProductSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 bg-white/5 hover:bg-white/[0.07] transition-colors text-left"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
          <Package className="h-4 w-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">{product.productNameEn}</p>
          <p className="text-xs text-white/40 mt-0.5">
            {product.variants.length} colour{product.variants.length !== 1 ? "s" : ""} ·{" "}
            {product.variants.reduce((s, v) => s + v.sizes.length, 0)} sizes
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-black text-amber-400">{product.totalQty}</p>
          <p className="text-[10px] text-white/30 uppercase tracking-wide">units ordered</p>
        </div>
        {open
          ? <ChevronDown className="h-5 w-5 text-white/30 shrink-0 ml-2" />
          : <ChevronRight className="h-5 w-5 text-white/30 shrink-0 ml-2" />}
      </button>

      {open && (
        <div className="divide-y divide-white/5">
          {product.variants.map((v) => (
            <ColorGroup key={v.variantId} variant={v} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export function PreordersClient({ products }: { products: ProductSummary[] }) {
  const grandTotal = products.reduce((s, p) => s + p.totalQty, 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-3">
          <p className="text-xs text-white/40 uppercase tracking-wider">Products</p>
          <p className="mt-0.5 text-2xl font-black text-white">{products.length}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-3">
          <p className="text-xs text-amber-400/60 uppercase tracking-wider">Total Units Preordered</p>
          <p className="mt-0.5 text-2xl font-black text-amber-400">{grandTotal}</p>
        </div>
      </div>

      {products.length === 0 && (
        <div className="rounded-2xl border border-white/10 py-20 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-white/10 mb-3" />
          <p className="text-white/30">No active preorders found.</p>
        </div>
      )}

      {/* Product list */}
      <div className="space-y-3">
        {products.map((p) => (
          <ProductCard key={p.productId} product={p} />
        ))}
      </div>
    </div>
  );
}
