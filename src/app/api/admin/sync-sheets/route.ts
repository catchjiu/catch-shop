import { NextRequest, NextResponse } from "next/server";
import { createClient as createSsrClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function postToSheets(webhookUrl: string, payload: unknown) {
  // Google Apps Script redirects POST → GET on 302, losing the body.
  // We handle this by manually following the redirect with a fresh POST.
  const body = JSON.stringify(payload);
  const headers = { "Content-Type": "application/json" };

  let res = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body,
    redirect: "manual", // handle redirect ourselves
  });

  // Follow one redirect manually (preserving POST + body)
  if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
    const location = res.headers.get("location");
    if (location) {
      res = await fetch(location, { method: "POST", headers, body });
    }
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin
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

    // Fetch orders
    const { data: orders, error: ordersError } = await db
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

    if (ordersError) {
      console.error("[sync-sheets] orders fetch error:", ordersError);
      return NextResponse.json({ error: `DB error: ${ordersError.message}` }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ success: true, synced: 0 });
    }

    // Try to fetch optional columns (may not exist yet)
    const enriched: Record<string, { academy: string | null; line_id: string | null }> = {};
    try {
      const { data: extra } = await db.from("orders").select("id, academy, line_id");
      (extra ?? []).forEach((r: { id: string; academy?: string | null; line_id?: string | null }) => {
        enriched[r.id] = { academy: r.academy ?? null, line_id: r.line_id ?? null };
      });
    } catch { /* columns may not exist */ }

    // Build payload
    type OI = {
      quantity: number;
      price_at_purchase: number;
      product_variants: { size: string; color: string; products: { name_en: string } | null } | null;
    };

    const payload = (orders as typeof orders & { order_items?: OI[] }[]).map((order) => {
      const ext = enriched[order.id] ?? { academy: null, line_id: null };
      const rawItems = (order as unknown as { order_items?: OI[] }).order_items ?? [];
      const items = rawItems.map((oi) => ({
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

    console.log(`[sync-sheets] pushing ${payload.length} orders to ${webhookUrl}`);

    const sheetsResult = await postToSheets(webhookUrl, payload);
    console.log("[sync-sheets] sheets response:", sheetsResult);

    return NextResponse.json({ success: true, synced: payload.length, sheetsResponse: sheetsResult });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sync-sheets] unhandled error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
