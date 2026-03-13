import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const secret = searchParams.get("secret");
  const orderId = searchParams.get("orderId"); // optional — single order fetch

  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();

  let query = db.from("orders").select(`
    id, created_at, status, payment_method, payment_ref,
    total_amount, is_preorder_order,
    shipping_name, shipping_email, shipping_phone,
    shipping_address, shipping_city, shipping_zip,
    order_items (
      quantity, price_at_purchase, selected_options,
      product_variants (
        size, color,
        products ( name_en )
      )
    )
  `).order("created_at", { ascending: false });

  if (orderId) {
    query = query.eq("id", orderId) as typeof query;
  }

  const { data: orders, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Try to enrich with optional academy / line_id columns
  const enriched: Record<string, { academy: string | null; line_id: string | null }> = {};
  try {
    let extQuery = db.from("orders").select("id, academy, line_id");
    if (orderId) extQuery = extQuery.eq("id", orderId) as typeof extQuery;
    const { data: extra } = await extQuery;
    (extra ?? []).forEach((r: { id: string; academy?: string | null; line_id?: string | null }) => {
      enriched[r.id] = { academy: r.academy ?? null, line_id: r.line_id ?? null };
    });
  } catch { /* columns may not exist */ }

  type OI = {
    quantity: number;
    price_at_purchase: number;
    selected_options?: { group: string; choice: string }[] | null;
    product_variants: { size: string; color: string; products: { name_en: string } | null } | null;
  };

  const payload = (orders ?? []).map((order) => {
    const ext = enriched[order.id] ?? { academy: null, line_id: null };
    const rawItems = (order as unknown as { order_items?: OI[] }).order_items ?? [];

    const items = rawItems.map((oi) => ({
      productName: oi.product_variants?.products?.name_en ?? "Product",
      color: oi.product_variants?.color ?? "",
      size: oi.product_variants?.size ?? "",
      quantity: oi.quantity,
      selectedOptions: oi.selected_options ?? [],
    }));

    return {
      id: order.id,
      createdAt: order.created_at,
      status: order.status,
      isPreorder: order.is_preorder_order,
      customerName: order.shipping_name,
      email: order.shipping_email,
      phone: order.shipping_phone ?? "",
      lineId: ext.line_id ?? "",
      academy: ext.academy ?? "",
      address: order.shipping_address,
      city: order.shipping_city,
      zip: order.shipping_zip ?? "",
      paymentMethod: order.payment_method,
      paymentRef: order.payment_ref ?? "",
      totalAmount: order.total_amount,
      items,
    };
  });

  return NextResponse.json(payload);
}
