"use client";

import { useState } from "react";
import { ShopNav } from "@/components/shop/ShopNav";
import { CartDrawer } from "@/components/shop/CartDrawer";

export function ShopClientWrapper({ children }: { children: React.ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <ShopNav onCartOpen={() => setCartOpen(true)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      {children}
    </>
  );
}
