import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json();

    if (!userId || !email) {
      return NextResponse.json({ error: "Missing userId or email" }, { status: 400 });
    }

    const serviceClient = await createServiceClient();

    const { count, error } = await serviceClient
      .from("orders")
      .update({ user_id: userId })
      .eq("guest_email", email)
      .is("user_id", null)
      .select("id", { count: "exact" });

    if (error) {
      console.error("Order linking error:", error);
      return NextResponse.json({ error: "Failed to link orders" }, { status: 500 });
    }

    return NextResponse.json({ linked: count ?? 0 });
  } catch (err) {
    console.error("Link orders error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
