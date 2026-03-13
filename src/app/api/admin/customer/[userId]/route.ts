import { NextRequest, NextResponse } from "next/server";
import { createClient as createSsrClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  // Only allow authenticated admins
  const ssr = await createSsrClient();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const admin = getServiceClient();

  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const m = data.user.user_metadata ?? {};
  return NextResponse.json({
    email: data.user.email,
    full_name: m.full_name ?? null,
    phone: m.phone ?? null,
    line_id: m.line_id ?? null,
    academy: m.academy ?? null,
    address: m.address ?? null,
    city: m.city ?? null,
    zip: m.zip ?? null,
  });
}
