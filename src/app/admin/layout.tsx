import type { Metadata } from "next";
import { LayoutGrid, Package, ShoppingBag, Tag, LogOut } from "lucide-react";
import Link from "next/link";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

export const metadata: Metadata = {
  title: "Matside Admin",
};

const navItems = [
  { href: "/admin/shop", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/shop/products", label: "Products", icon: Tag },
  { href: "/admin/shop/inventory", label: "Inventory", icon: Package },
  { href: "/admin/shop/orders", label: "Orders", icon: ShoppingBag },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">

      {/* ── Desktop sidebar (lg+) ───────────────────────────────── */}
      <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-white/10 bg-slate-900 lg:flex">
        <div className="flex h-16 items-center border-b border-white/10 px-6">
          <Link href="/en/shop" className="text-lg font-black tracking-tight text-white">
            MATSIDE <span className="text-white/40">ADMIN</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <Link
            href="/en/shop"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Back to Shop
          </Link>
        </div>
      </aside>

      {/* ── Mobile header + slide-out drawer (< lg) ────────────── */}
      <AdminMobileNav />

      {/* ── Main content ───────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>

    </div>
  );
}
