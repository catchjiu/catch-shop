"use client";

import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/hooks/useCart";
import { LocaleSwitcher } from "./LocaleSwitcher";

interface ShopNavProps {
  onCartOpen: () => void;
}

export function ShopNav({ onCartOpen }: ShopNavProps) {
  const t = useTranslations("nav");
  const totalItems = useCart((s) => s.getTotalItems());

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-black tracking-tight text-white">
          MATSIDE
        </Link>

        <nav className="hidden sm:flex items-center gap-6">
          <Link href="/shop" className="text-sm text-white/70 hover:text-white transition-colors">
            {t("shop")}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <button
            onClick={onCartOpen}
            className="relative flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-sm text-white/70 hover:border-white/40 hover:text-white transition-all"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">{t("cart")}</span>
            {totalItems > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-900">
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
