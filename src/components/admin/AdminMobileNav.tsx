"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LayoutGrid, Package, ShoppingBag, Tag, LogOut } from "lucide-react";

const navItems = [
  { href: "/admin/shop", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/shop/products", label: "Products", icon: Tag },
  { href: "/admin/shop/inventory", label: "Inventory", icon: Package },
  { href: "/admin/shop/orders", label: "Orders", icon: ShoppingBag },
];

export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer whenever the route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────────── */}
      <header className="flex h-14 items-center justify-between border-b border-white/10 bg-slate-900 px-4 lg:hidden">
        <Link href="/en/shop" className="text-base font-black tracking-tight text-white">
          MATSIDE <span className="text-white/40">ADMIN</span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* ── Backdrop ───────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Slide-out drawer ───────────────────────────────────────── */}
      <div
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 border-r border-white/10 shadow-2xl transition-transform duration-300 lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Drawer header */}
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-5">
          <span className="text-base font-black tracking-tight text-white">
            MATSIDE <span className="text-white/40">ADMIN</span>
          </span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/admin/shop" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors",
                  isActive
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/60 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-4">
          <Link
            href="/en/shop"
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Back to Shop
          </Link>
        </div>
      </div>
    </>
  );
}
