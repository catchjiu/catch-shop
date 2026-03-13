"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { SelectedOption } from "@/lib/supabase/types";

export interface CartItem {
  cartKey: string;          // unique: variantId + options fingerprint
  variantId: string;
  productId: string;
  productSlug: string;
  nameEn: string;
  nameZh: string;
  size: string;
  color: string;
  imageUrl: string | null;
  price: number;            // base price + sum of priceAdds
  quantity: number;
  isPreorder: boolean;
  selectedOptions: SelectedOption[];
}

function makeCartKey(variantId: string, selectedOptions: SelectedOption[]): string {
  if (!selectedOptions || selectedOptions.length === 0) return variantId;
  const sorted = [...selectedOptions].sort((a, b) => a.name.localeCompare(b.name));
  return `${variantId}::${JSON.stringify(sorted)}`;
}

interface CartState {
  items: CartItem[];
  guestEmail: string | null;
  memberId: string | null;

  addItem: (item: Omit<CartItem, "quantity" | "cartKey">) => void;
  removeItem: (cartKey: string) => void;
  updateQuantity: (cartKey: string, quantity: number) => void;
  clearCart: () => void;
  setGuestEmail: (email: string) => void;
  setMemberId: (id: string | null) => void;
  validateStock: () => Promise<boolean>;
  getTotalAmount: () => number;
  getTotalItems: () => number;
  hasPreorderItems: () => boolean;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      guestEmail: null,
      memberId: null,

      addItem: (newItem) => {
        const cartKey = makeCartKey(newItem.variantId, newItem.selectedOptions ?? []);
        set((state) => {
          const existing = state.items.find((i) => i.cartKey === cartKey);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i
              ),
            };
          }
          return { items: [...state.items, { ...newItem, cartKey, quantity: 1 }] };
        });
      },

      removeItem: (cartKey) => {
        set((state) => ({
          items: state.items.filter((i) => i.cartKey !== cartKey),
        }));
      },

      updateQuantity: (cartKey, quantity) => {
        if (quantity <= 0) {
          get().removeItem(cartKey);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.cartKey === cartKey ? { ...i, quantity } : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      setGuestEmail: (email) => set({ guestEmail: email }),

      setMemberId: (id) => set({ memberId: id }),

      validateStock: async () => {
        const { items } = get();
        if (items.length === 0) return true;

        const supabase = createClient();
        const variantIds = items.map((i) => i.variantId);

        const { data: variants, error } = await supabase
          .from("product_variants")
          .select("id, stock_quantity")
          .in("id", variantIds);

        if (error || !variants) return false;

        let allValid = true;
        const updatedItems = items.map((item) => {
          const variant = variants.find((v) => v.id === item.variantId);
          if (!variant) {
            toast.error(`Item no longer available`, {
              description: `${item.nameEn} (${item.size}) has been removed from your cart.`,
            });
            allValid = false;
            return null;
          }

          if (item.isPreorder) return item;

          if (item.quantity > variant.stock_quantity) {
            if (variant.stock_quantity === 0) {
              toast.error(`Out of stock`, {
                description: `${item.nameEn} (${item.size}) is now out of stock.`,
              });
              allValid = false;
              return null;
            }
            toast.warning(`Stock adjusted`, {
              description: `Only ${variant.stock_quantity} of ${item.nameEn} (${item.size}) left. Quantity updated.`,
            });
            return { ...item, quantity: variant.stock_quantity };
          }
          return item;
        });

        const validItems = updatedItems.filter(Boolean) as CartItem[];
        set({ items: validItems });
        return allValid;
      },

      getTotalAmount: () => {
        return get().items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
      },

      getTotalItems: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      hasPreorderItems: () => {
        return get().items.some((item) => item.isPreorder);
      },
    }),
    {
      name: "matside-cart",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
