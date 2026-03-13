import { NextRequest, NextResponse } from "next/server";
import { createClient as createSsrClient } from "@/lib/supabase/server";

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

    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "WEBHOOK_SECRET not configured" }, { status: 500 });
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://mat-side.com").replace(/\/$/, "");
    const exportApiUrl = `${siteUrl}/api/admin/orders-export`;

    // Build the GET URL — Apps Script fetches orders from our export endpoint
    const gasUrl = new URL(webhookUrl);
    gasUrl.searchParams.set("action", "sync");
    gasUrl.searchParams.set("apiUrl", exportApiUrl);
    gasUrl.searchParams.set("secret", secret);

    console.log(`[sync-sheets] calling Apps Script GET: ${gasUrl.toString().slice(0, 120)}...`);

    // GET requests to Google Apps Script work without redirect issues
    const res = await fetch(gasUrl.toString(), { method: "GET" });
    const text = await res.text();

    console.log(`[sync-sheets] Apps Script response (${res.status}):`, text.slice(0, 300));

    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      result = { raw: text };
    }

    return NextResponse.json({ success: true, sheetsResponse: result });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sync-sheets] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
