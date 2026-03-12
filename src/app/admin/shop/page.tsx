import { createServiceClient } from "@/lib/supabase/server";
import { formatTWD } from "@/lib/currency";
import {
  TrendingUp,
  ShoppingBag,
  Package,
  Users,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Dashboard — Catch BJJ Admin" };

export default async function AdminDashboardPage() {
  const supabase = await createServiceClient();

  // Revenue (completed orders)
  const { data: revenueData } = await supabase
    .from("orders")
    .select("total_amount")
    .in("status", ["completed", "processing", "shipped", "ready_for_pickup"]);

  const totalRevenue =
    revenueData?.reduce((sum, o) => sum + o.total_amount, 0) ?? 0;

  // Total orders
  const { count: totalOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true });

  // Member vs guest
  const { count: memberOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .not("user_id", "is", null);

  const guestOrders = (totalOrders ?? 0) - (memberOrders ?? 0);
  const memberRatio =
    totalOrders && totalOrders > 0
      ? Math.round(((memberOrders ?? 0) / totalOrders) * 100)
      : 0;

  // Top selling products
  const { data: topItems } = await supabase
    .from("order_items")
    .select("quantity, price_at_purchase, product_variants(products(name_en, slug))")
    .order("quantity", { ascending: false })
    .limit(50);

  // Aggregate by product
  const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
  topItems?.forEach((item) => {
    const variant = item.product_variants as {
      products: { name_en: string; slug: string } | null;
    } | null;
    const name = variant?.products?.name_en ?? "Unknown";
    if (!productSales[name]) {
      productSales[name] = { name, quantity: 0, revenue: 0 };
    }
    productSales[name].quantity += item.quantity;
    productSales[name].revenue += item.quantity * item.price_at_purchase;
  });
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Low stock count
  const { count: lowStockCount } = await supabase
    .from("product_variants")
    .select("id", { count: "exact", head: true })
    .lt("stock_quantity", 5);

  // Recent orders
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, shipping_name, total_amount, status, created_at, is_preorder_order")
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-white/50">Sales overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Revenue"
          value={formatTWD(totalRevenue, "en")}
          icon={<TrendingUp className="h-5 w-5" />}
          color="text-green-400"
          bg="bg-green-400/10"
        />
        <KpiCard
          title="Total Orders"
          value={String(totalOrders ?? 0)}
          icon={<ShoppingBag className="h-5 w-5" />}
          color="text-blue-400"
          bg="bg-blue-400/10"
        />
        <KpiCard
          title="Member Orders"
          value={`${memberRatio}%`}
          subtitle={`${memberOrders ?? 0} members · ${guestOrders} guests`}
          icon={<Users className="h-5 w-5" />}
          color="text-purple-400"
          bg="bg-purple-400/10"
        />
        <KpiCard
          title="Low Stock Items"
          value={String(lowStockCount ?? 0)}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="text-amber-400"
          bg="bg-amber-400/10"
          href="/admin/shop/inventory"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Products */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-white/50" />
            <h2 className="font-semibold text-white">Top Products</h2>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-white/30">No sales data yet.</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((product, i) => (
                <div key={product.name} className="flex items-center gap-3">
                  <span className="w-5 text-xs font-bold text-white/30">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-white">{product.name}</p>
                    <p className="text-xs text-white/40">
                      {product.quantity} sold · {formatTWD(product.revenue, "en")}
                    </p>
                  </div>
                  <div
                    className="h-1.5 rounded-full bg-white/20"
                    style={{
                      width: `${Math.max(20, (product.quantity / (topProducts[0]?.quantity || 1)) * 80)}px`,
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-white/50" />
              <h2 className="font-semibold text-white">Recent Orders</h2>
            </div>
            <Link
              href="/admin/shop/orders"
              className="text-xs text-white/40 hover:text-white transition-colors"
            >
              View all →
            </Link>
          </div>
          {!recentOrders || recentOrders.length === 0 ? (
            <p className="text-sm text-white/30">No orders yet.</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                >
                  <div>
                    <p className="text-sm text-white">{order.shipping_name}</p>
                    <p className="text-xs text-white/40">
                      #{order.id.slice(0, 8).toUpperCase()} ·{" "}
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">
                      {formatTWD(order.total_amount, "en")}
                    </p>
                    <span className="text-xs text-white/40 capitalize">
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  color,
  bg,
  href,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/[0.07] transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-white/50">{title}</p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-white/40">{subtitle}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${bg} ${color}`}>{icon}</div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
