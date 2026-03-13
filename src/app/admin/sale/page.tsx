import { createClient } from "@supabase/supabase-js";
import { SaleClient } from "./SaleClient";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function SalePage() {
  const db = getServiceClient();
  const { data: products } = await db
    .from("products")
    .select("id, name_en, name_zh, slug, price_twd, compare_at_price_twd, base_image_url, is_active")
    .order("name_en");

  return <SaleClient products={products ?? []} />;
}
