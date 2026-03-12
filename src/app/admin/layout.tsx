import type { Metadata } from "next";
import { LayoutGrid, Package, ShoppingBag, BarChart3, LogOut } from "lucide-react";
import Link from "next/link";
import "../globals.css";

export const metadata: Metadata = {
  title: "Catch BJJ Admin",
};

const navItems = [
  { href: "/admin/shop", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/shop/inventory", label: "Inventory", icon: Package },
  { href: "/admin/shop/orders", label: "Orders", icon: ShoppingBag },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-950 text-slate-50 antialiased min-h-screen">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-white/10 bg-slate-900 lg:flex">
            <div className="flex h-16 items-center border-b border-white/10 px-6">
              <Link href="/en/shop" className="text-lg font-black tracking-tight text-white">
                CATCH <span className="text-white/40">ADMIN</span>
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

          {/* Main */}
          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
