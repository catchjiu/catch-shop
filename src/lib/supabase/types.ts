export type OrderStatus =
  | "pending_payment"
  | "processing"
  | "shipped"
  | "ready_for_pickup"
  | "completed"
  | "cancelled";

export type PaymentMethod = "manual_bank_transfer" | "newebpay";

export interface Product {
  id: string;
  slug: string;
  name_en: string;
  name_zh: string;
  description_en: string | null;
  description_zh: string | null;
  price_twd: number;
  base_image_url: string | null;
  is_preorder: boolean;
  preorder_note_en: string | null;
  preorder_note_zh: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  color: string;
  stock_quantity: number;
  sku: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductWithVariants extends Product {
  product_variants: ProductVariant[];
}

export interface Order {
  id: string;
  user_id: string | null;
  guest_email: string | null;
  shipping_name: string;
  shipping_email: string;
  shipping_phone: string | null;
  shipping_address: string;
  shipping_city: string;
  shipping_zip: string | null;
  shipping_country: string;
  total_amount: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_ref: string | null;
  is_preorder_order: boolean;
  newebpay_trade_no: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  variant_id: string;
  quantity: number;
  price_at_purchase: number;
  created_at: string;
}

export interface OrderWithItems extends Order {
  order_items: (OrderItem & {
    product_variants: ProductVariant & {
      products: Pick<Product, "id" | "slug" | "name_en" | "name_zh" | "base_image_url">;
    };
  })[];
}

export interface Database {
  public: {
    Tables: {
      products: {
        Row: Product;
        Insert: Omit<Product, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Product, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      product_variants: {
        Row: ProductVariant;
        Insert: Omit<ProductVariant, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ProductVariant, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Order, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<OrderItem, "id" | "created_at">;
        Update: Partial<Omit<OrderItem, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Enums: {
      order_status: OrderStatus;
      payment_method: PaymentMethod;
    };
    Functions: {
      decrement_stock: {
        Args: { p_variant_id: string; p_quantity: number };
        Returns: void;
      };
    };
    CompositeTypes: Record<string, never>;
  };
}
