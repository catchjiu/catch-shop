import { createServiceClient } from "@/lib/supabase/server";
import { PreordersClient } from "./PreordersClient";
import type { ProductSummary, VariantSummary } from "./PreordersClient";
import type { OrderStatus } from "@/lib/supabase/types";
import { Clock } from "lucide-react";

export const metadata = { title: "Preorder Summary — Matside Admin" };

export default async function PreordersPage() {
  const supabase = await createServiceClient();

  // Fetch all order_items belonging to active preorder orders (not cancelled)
  const { data: items } = await supabase
    .from("order_items")
    .select(`
      id, quantity, selected_options,
      product_variants (
        id, size, color,
        products ( id, name_en, name_zh, slug )
      ),
      orders (
        id, created_at, status, payment_method, payment_ref,
        shipping_name, shipping_email, shipping_phone,
        is_preorder_order, academy, line_id
      )
    `)
    .order("created_at", { referencedTable: "orders", ascending: false });

  // Filter to only preorder orders that aren't cancelled
  type RawItem = typeof items extends (infer T)[] | null ? T : never;

  const preorderItems = (items ?? []).filter((item: RawItem) => {
    const o = item.orders as { is_preorder_order: boolean; status: string } | null;
    return o?.is_preorder_order === true && o?.status !== "cancelled";
  });

  // ── Aggregate into product → color → size hierarchy ──────────────────────

  // Map: productId → ProductSummary
  const productMap = new Map<string, ProductSummary>();

  for (const item of preorderItems) {
    const pv = item.product_variants as {
      id: string; size: string; color: string;
      products: { id: string; name_en: string; name_zh: string; slug: string } | null;
    } | null;
    const order = item.orders as {
      id: string; created_at: string; status: string; payment_method: string;
      payment_ref: string | null; shipping_name: string; shipping_email: string;
      shipping_phone: string | null; academy: string | null; line_id: string | null;
    } | null;

    if (!pv?.products || !order) continue;

    const prod = pv.products;
    const orderRow = {
      orderId: order.id,
      orderRef: order.id.slice(0, 8).toUpperCase(),
      createdAt: order.created_at,
      status: order.status as OrderStatus,
      customerName: order.shipping_name,
      customerEmail: order.shipping_email,
      phone: order.shipping_phone,
      lineId: order.line_id,
      academy: order.academy,
      quantity: item.quantity,
      selectedOptions: item.selected_options as Array<{ name: string; choice: string; priceAdd: number }> | null,
      paymentMethod: order.payment_method,
      paymentRef: order.payment_ref,
    };

    // Ensure product entry
    if (!productMap.has(prod.id)) {
      productMap.set(prod.id, {
        productId: prod.id,
        productNameEn: prod.name_en,
        productSlug: prod.slug,
        totalQty: 0,
        variants: [],
      });
    }
    const productEntry = productMap.get(prod.id)!;
    productEntry.totalQty += item.quantity;

    // Find or create color variant group
    let colorGroup = productEntry.variants.find(
      (v) => v.color.toLowerCase() === pv.color.toLowerCase()
    );
    if (!colorGroup) {
      colorGroup = {
        variantId: `${prod.id}::${pv.color}`,
        productNameEn: prod.name_en,
        productSlug: prod.slug,
        color: pv.color,
        totalQty: 0,
        orders: [],
        sizes: [],
      } satisfies VariantSummary;
      productEntry.variants.push(colorGroup);
    }
    colorGroup.totalQty += item.quantity;
    colorGroup.orders.push(orderRow);

    // Find or create size entry
    let sizeEntry = colorGroup.sizes.find(
      (s) => s.size.toLowerCase() === pv.size.toLowerCase()
    );
    if (!sizeEntry) {
      sizeEntry = { size: pv.size, qty: 0, orders: [] };
      colorGroup.sizes.push(sizeEntry);
    }
    sizeEntry.qty += item.quantity;
    sizeEntry.orders.push(orderRow);
  }

  // Sort sizes within each color by standard order
  const SIZE_ORDER = ["M000","M00","M0","M1","M2","M3","M4","A0","A1","A1L","A2","A3","A4","F1","F2","F3","F4","Y-XS","Y-S","Y-M","Y-L","XS","S","M","L","XL","XXL"];
  const sizeIndex = (s: string) => {
    const i = SIZE_ORDER.findIndex((x) => x.toUpperCase() === s.toUpperCase());
    return i === -1 ? 999 : i;
  };

  const products: ProductSummary[] = [...productMap.values()].map((p) => ({
    ...p,
    variants: p.variants.map((v) => ({
      ...v,
      sizes: v.sizes.sort((a, b) => sizeIndex(a.size) - sizeIndex(b.size)),
    })),
  })).sort((a, b) => b.totalQty - a.totalQty);

  const grandTotal = products.reduce((s, p) => s + p.totalQty, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 shrink-0">
          <Clock className="h-6 w-6 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Preorder Summary</h1>
          <p className="mt-1 text-sm text-white/50">
            {grandTotal} unit{grandTotal !== 1 ? "s" : ""} across {products.length} product{products.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <PreordersClient products={products} />
    </div>
  );
}
