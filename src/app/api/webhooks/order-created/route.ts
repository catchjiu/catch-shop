import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Verify the webhook secret
  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) {
    // Not an error — sheets sync is optional
    return NextResponse.json({ success: true, skipped: "no webhook url" });
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

  const webhookSecret = process.env.WEBHOOK_SECRET!;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://mat-side.com").replace(/\/$/, "");
  const exportApiUrl = `${siteUrl}/api/admin/orders-export`;

  // Use GET — Apps Script pulls the single order from our export endpoint
  const gasUrl = new URL(webhookUrl);
  gasUrl.searchParams.set("action", "single");
  gasUrl.searchParams.set("apiUrl", exportApiUrl);
  gasUrl.searchParams.set("secret", webhookSecret);
  gasUrl.searchParams.set("orderId", orderId);

  try {
    const res = await fetch(gasUrl.toString(), { method: "GET" });
    const text = await res.text();
    console.log(`[webhook] Apps Script response (${res.status}):`, text.slice(0, 200));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[webhook] sheets push failed", err);
    return NextResponse.json({ error: "Sheets push failed" }, { status: 500 });
  }
}
