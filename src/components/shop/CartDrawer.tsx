"use client";

import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/hooks/useCart";
import { formatTWD } from "@/lib/currency";
import { Link } from "@/i18n/navigation";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { items, removeItem, updateQuantity, getTotalAmount } = useCart();

  const total = getTotalAmount();

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-white/10 bg-slate-950 sm:max-w-md"
      >
        <SheetHeader className="border-b border-white/10 pb-4">
          <SheetTitle className="flex items-center gap-2 text-white">
            <ShoppingBag className="h-5 w-5" />
            {t("cart.title")}
            {items.length > 0 && (
              <span className="ml-auto text-sm font-normal text-white/50">
                {items.reduce((s, i) => s + i.quantity, 0)} {t("cart.quantity")}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12">
            <ShoppingBag className="h-16 w-16 text-white/10" />
            <p className="text-white/50">{t("cart.empty")}</p>
            <Button
              variant="outline"
              className="border-white/20 text-white/70 hover:border-white/40 hover:text-white"
              onClick={onClose}
              asChild
            >
              <Link href="/shop">{t("cart.startShopping")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 py-4">
              <AnimatePresence initial={false}>
                {items.map((item) => {
                  const name = locale === "zh-TW" ? item.nameZh : item.nameEn;
                  return (
                    <motion.div
                      key={item.cartKey ?? item.variantId}
                      layout
                      initial={{ opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 40 }}
                      transition={{ duration: 0.2 }}
                      className="mb-4 flex gap-3 pr-2"
                    >
                      {/* Product image */}
                      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-slate-800">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={name}
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-white/10 text-xs font-bold">
                            MATSIDE
                          </div>
                        )}
                      </div>

                      {/* Item details */}
                      <div className="flex flex-1 flex-col gap-1 min-w-0">
                        <p className="truncate text-sm font-medium text-white">{name}</p>
                        <p className="text-xs text-white/50">
                          {item.size} · {item.color}
                          {item.isPreorder && (
                            <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-amber-400 text-[10px]">
                              {locale === "zh-TW" ? "預購" : "Preorder"}
                            </span>
                          )}
                        </p>
                        {item.selectedOptions && item.selectedOptions.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.selectedOptions.map((opt) => (
                              <span key={opt.name} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
                                {opt.choice}
                                {opt.priceAdd > 0 && ` +${opt.priceAdd}`}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-sm font-semibold text-white/80">
                          {formatTWD(item.price, locale)}
                        </p>

                        {/* Quantity controls */}
                        <div className="mt-auto flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.cartKey ?? item.variantId, item.quantity - 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-md border border-white/20 text-white/60 hover:border-white/40 hover:text-white transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-sm text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.cartKey ?? item.variantId, item.quantity + 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-md border border-white/20 text-white/60 hover:border-white/40 hover:text-white transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => removeItem(item.cartKey ?? item.variantId)}
                            className="ml-auto flex h-6 w-6 items-center justify-center text-white/30 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </ScrollArea>

            <div className="border-t border-white/10 pt-4 space-y-4">
              <Separator className="bg-white/5" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">{t("cart.subtotal")}</span>
                <span className="text-lg font-bold text-white">
                  {formatTWD(total, locale)}
                </span>
              </div>
              <Button
                className="w-full bg-white text-slate-900 hover:bg-white/90 font-semibold"
                onClick={onClose}
                asChild
              >
                <Link href="/checkout">{t("cart.checkout")}</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
