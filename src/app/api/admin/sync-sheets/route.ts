import { NextRequest, NextResponse } from "next/server";
import { createClient as createSsrClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: NextRequest) {
  // Verify the caller is an admin
  const ssr = await createSsrClient();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "GOOGLE_SHEETS_WEBHOOK_URL not configured" }, { status: 500 });
  }

  const db = getServiceClient();

  // Fetch all orders with items
  const { data: orders, error } = await db
    .from("orders")
    .select(`
      id, created_at, status, payment_method, payment_ref,
      total_amount, is_preorder_order,
      shipping_name, shipping_email, shipping_phone,
      shipping_address, shipping_city, shipping_zip,
      order_items (
        quantity, price_at_purchase,
        product_variants (
          size, color,
          products ( name_en )
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error || !orders) {
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }

  // Also try to fetch optional columns (academy, line_id) — safe if they don't exist
  const enriched: Record<string, { academy: string | null; line_id: string | null }> = {};
  try {
    const { data: extra } = await db
      .from("orders")
      .select("id, academy, line_id");
    (extra ?? []).forEach((r: { id: string; academy: string | null; line_id: string | null }) => {
      enriched[r.id] = { academy: r.academy, line_id: r.line_id };
    });
  } catch { /* columns may not exist yet */ }

  // Format orders for the Apps Script
  const payload = orders.map((order) => {
    const ext = enriched[order.id] ?? { academy: null, line_id: null };
    const items = (order.order_items ?? []).map((oi: {
      quantity: number;
      price_at_purchase: number;
      product_variants: {
        size: string;
        color: string;
        products: { name_en: string } | null;
      } | null;
    }) => ({
      productName: oi.product_variants?.products?.name_en ?? "Product",
      color: oi.product_variants?.color ?? "",
      size: oi.product_variants?.size ?? "",
      quantity: oi.quantity,
      selectedOptions: [],
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

  // Push to Google Apps Script
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    return NextResponse.json({ success: true, synced: payload.length, sheetsResponse: result });
  } catch (err) {
    console.error("Sheets sync error:", err);
    return NextResponse.json({ error: "Failed to reach Google Sheets" }, { status: 500 });
  }
}
