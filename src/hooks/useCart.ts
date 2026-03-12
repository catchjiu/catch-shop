"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export interface CartItem {
  variantId: string;
  productId: string;
  productSlug: string;
  nameEn: string;
  nameZh: string;
  size: string;
  color: string;
  imageUrl: string | null;
  price: number;
  quantity: number;
  isPreorder: boolean;
}

interface CartState {
  items: CartItem[];
  guestEmail: string | null;
  memberId: string | null;

  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
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
        set((state) => {
          const existing = state.items.find((i) => i.variantId === newItem.variantId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === newItem.variantId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...newItem, quantity: 1 }] };
        });
      },

      removeItem: (variantId) => {
        set((state) => ({
          items: state.items.filter((i) => i.variantId !== variantId),
        }));
      },

      updateQuantity: (variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(variantId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.variantId === variantId ? { ...i, quantity } : i
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
