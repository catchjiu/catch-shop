import { createServiceClient } from "@/lib/supabase/server";
import { OrdersClient } from "./OrdersClient";

export const metadata = { title: "Orders — Matside Admin" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "all" } = await searchParams;
  const supabase = await createServiceClient();

  let query = supabase
    .from("orders")
    .select("id, created_at, status, payment_method, payment_ref, total_amount, is_preorder_order, shipping_name, shipping_email, guest_email, user_id")
    .order("created_at", { ascending: false });

  if (filter === "preorder") {
    query = query.eq("is_preorder_order", true);
  } else if (filter === "pending") {
    query = query.eq("status", "pending_payment");
  } else if (filter === "completed") {
    query = query.eq("status", "completed");
  }

  const { data: orders } = await query;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Order Management</h1>
        <p className="mt-1 text-sm text-white/50">
          {orders?.length ?? 0} orders
        </p>
      </div>
      <OrdersClient orders={orders ?? []} currentFilter={filter} />
    </div>
  );
}
