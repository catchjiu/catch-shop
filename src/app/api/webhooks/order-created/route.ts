import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: NextRequest) {
  // Verify the webhook secret to prevent abuse
  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "GOOGLE_SHEETS_WEBHOOK_URL not set" }, { status: 500 });
  }

  let body: { record?: { id?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = body?.record?.id;
  if (!orderId) {
    return NextResponse.json({ error: "No order ID in payload" }, { status: 400 });
  }

  const db = getServiceClient();

  // Fetch the full order
  const { data: order, error } = await db
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
    .eq("id", orderId)
    .single();

  if (error || !order) {
    console.error("Webhook: failed to fetch order", orderId, error);
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Try optional columns
  let academy: string | null = null;
  let lineId: string | null = null;
  try {
    const { data: ext } = await db
      .from("orders")
      .select("academy, line_id")
      .eq("id", orderId)
      .single();
    academy = (ext as { academy: string | null })?.academy ?? null;
    lineId = (ext as { line_id: string | null })?.line_id ?? null;
  } catch { /* columns may not exist */ }

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

  const payload = {
    id: order.id,
    createdAt: order.created_at,
    status: order.status,
    isPreorder: order.is_preorder_order,
    customerName: order.shipping_name,
    email: order.shipping_email,
    phone: order.shipping_phone ?? "",
    lineId: lineId ?? "",
    academy: academy ?? "",
    address: order.shipping_address,
    city: order.shipping_city,
    zip: order.shipping_zip ?? "",
    paymentMethod: order.payment_method,
    paymentRef: order.payment_ref ?? "",
    totalAmount: order.total_amount,
    items,
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook: sheets push failed", err);
    return NextResponse.json({ error: "Sheets push failed" }, { status: 500 });
  }
}
