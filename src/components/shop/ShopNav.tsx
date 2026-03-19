"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShoppingCart, Menu, Building2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useCart } from "@/hooks/useCart";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { UserMenu } from "./UserMenu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

interface ShopNavProps {
  onCartOpen: () => void;
}

export function ShopNav({ onCartOpen }: ShopNavProps) {
  const t = useTranslations("nav");
  const tBank = useTranslations("success");
  const totalItems = useCart((s) => s.getTotalItems());
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
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

          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <UserMenu />

            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMobileOpen(true)}
              className="sm:hidden flex items-center justify-center rounded-md border border-white/20 p-1.5 text-white/70 hover:border-white/40 hover:text-white transition-all"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

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

      {/* Mobile nav drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="flex w-72 flex-col border-white/10 bg-slate-950 px-0"
        >
          <SheetHeader className="border-b border-white/10 px-5 pb-4">
            <SheetTitle className="text-xl font-black tracking-tight text-white">
              MATSIDE
            </SheetTitle>
          </SheetHeader>

          {/* Nav links */}
          <nav className="px-4 pt-4 space-y-1">
            <Link
              href="/shop"
              onClick={() => setMobileOpen(false)}
              className="flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors"
            >
              {t("shop")}
            </Link>
          </nav>

          <Separator className="mx-4 my-4 bg-white/10" />

          {/* Transfer Details */}
          <div className="px-4">
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-blue-300">
                <Building2 className="h-4 w-4 shrink-0" />
                <h3 className="text-sm font-semibold">
                  {tBank("bankDetails.title")}
                </h3>
              </div>
              <Separator className="bg-blue-500/20" />
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-white/50 shrink-0">{tBank("bankDetails.bank")}</dt>
                  <dd className="text-white text-right">{tBank("bankDetails.bankName")}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-white/50 shrink-0">{tBank("bankDetails.account")}</dt>
                  <dd className="font-mono text-white">{tBank("bankDetails.accountNumber")}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-white/50 shrink-0">{tBank("bankDetails.accountName")}</dt>
                  <dd className="text-white text-right">{tBank("bankDetails.accountHolder")}</dd>
                </div>
              </dl>
              <p className="rounded-lg bg-blue-500/10 p-2.5 text-xs text-blue-300/80">
                {tBank("bankDetails.note")}
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
