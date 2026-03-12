-- ============================================================
-- CATCH JIU JITSU — E-Commerce Schema
-- Migration: 0001_shop_schema.sql
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE order_status AS ENUM (
  'pending_payment',
  'processing',
  'shipped',
  'ready_for_pickup',
  'completed',
  'cancelled'
);

CREATE TYPE payment_method AS ENUM (
  'manual_bank_transfer',
  'newebpay'
);

-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            TEXT NOT NULL UNIQUE,
  name_en         TEXT NOT NULL,
  name_zh         TEXT NOT NULL,
  description_en  TEXT,
  description_zh  TEXT,
  price_twd       INTEGER NOT NULL CHECK (price_twd >= 0),
  base_image_url  TEXT,
  is_preorder     BOOLEAN NOT NULL DEFAULT FALSE,
  preorder_note_en TEXT,
  preorder_note_zh TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_slug ON products (slug);
CREATE INDEX idx_products_is_active ON products (is_active);

-- ============================================================
-- PRODUCT VARIANTS
-- ============================================================

CREATE TABLE product_variants (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id     UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  size           TEXT NOT NULL,
  color          TEXT NOT NULL DEFAULT 'default',
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  sku            TEXT UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, size, color)
);

CREATE INDEX idx_product_variants_product_id ON product_variants (product_id);

-- ============================================================
-- ORDERS
-- ============================================================

CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  guest_email       TEXT,
  -- Shipping info snapshot
  shipping_name     TEXT NOT NULL,
  shipping_email    TEXT NOT NULL,
  shipping_phone    TEXT,
  shipping_address  TEXT NOT NULL,
  shipping_city     TEXT NOT NULL,
  shipping_zip      TEXT,
  shipping_country  TEXT NOT NULL DEFAULT 'TW',
  -- Financials
  total_amount      INTEGER NOT NULL CHECK (total_amount >= 0),
  -- Status & payment
  status            order_status NOT NULL DEFAULT 'pending_payment',
  payment_method    payment_method NOT NULL,
  payment_ref       TEXT,
  is_preorder_order BOOLEAN NOT NULL DEFAULT FALSE,
  -- NewebPay trade number (MerchantOrderNo)
  newebpay_trade_no TEXT UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_user_or_guest CHECK (user_id IS NOT NULL OR guest_email IS NOT NULL)
);

CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_guest_email ON orders (guest_email);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_is_preorder ON orders (is_preorder_order);

-- ============================================================
-- ORDER ITEMS
-- ============================================================

CREATE TABLE order_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  variant_id        UUID NOT NULL REFERENCES product_variants (id) ON DELETE RESTRICT,
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  price_at_purchase INTEGER NOT NULL CHECK (price_at_purchase >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_variant_id ON order_items (variant_id);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- STOCK DECREMENT FUNCTION (prevents overselling)
-- ============================================================

CREATE OR REPLACE FUNCTION decrement_stock(p_variant_id UUID, p_quantity INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE product_variants
  SET stock_quantity = stock_quantity - p_quantity
  WHERE id = p_variant_id AND stock_quantity >= p_quantity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_stock' USING DETAIL = p_variant_id::TEXT;
  END IF;
END;
$$;

-- ============================================================
-- GUEST-TO-MEMBER ORDER LINKING TRIGGER
-- When a new user signs up and their email matches guest orders,
-- link those orders to the new user_id.
-- ============================================================

CREATE OR REPLACE FUNCTION link_guest_orders_to_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE orders
  SET user_id = NEW.id
  WHERE guest_email = NEW.email
    AND user_id IS NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_link_guest_orders
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION link_guest_orders_to_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Products: anyone can read active products
CREATE POLICY "Public read active products"
  ON products FOR SELECT
  USING (is_active = TRUE);

-- Product variants: anyone can read variants of active products
CREATE POLICY "Public read active product variants"
  ON product_variants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_variants.product_id AND p.is_active = TRUE
    )
  );

-- Orders: users can read and create their own orders
CREATE POLICY "Users read own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Guests can insert orders (no user_id, requires guest_email)
CREATE POLICY "Guests insert orders"
  ON orders FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL AND guest_email IS NOT NULL);

-- Order items: users can read their own order items
CREATE POLICY "Users read own order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
    )
  );

-- Admin policies: service role bypasses RLS automatically
-- Products admin write
CREATE POLICY "Admins manage products"
  ON products FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Product variants admin write
CREATE POLICY "Admins manage product variants"
  ON product_variants FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Orders admin full access
CREATE POLICY "Admins manage orders"
  ON orders FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Order items admin full access
CREATE POLICY "Admins manage order items"
  ON order_items FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ============================================================
-- SEED: Sample products for development
-- ============================================================

INSERT INTO products (slug, name_en, name_zh, description_en, description_zh, price_twd, is_preorder, preorder_note_en, preorder_note_zh) VALUES
(
  'catch-bjj-gi-white',
  'Catch BJJ Gi — White',
  'Catch 柔術道衣 — 白色',
  'High-performance competition gi made from premium pearl weave cotton. Designed for durability and comfort on the mat.',
  '採用優質珍珠織棉製成的高性能競賽道衣，專為耐用性和舒適性設計。',
  3800,
  FALSE,
  NULL,
  NULL
),
(
  'catch-bjj-gi-black',
  'Catch BJJ Gi — Black',
  'Catch 柔術道衣 — 黑色',
  'Premium black competition gi with embroidered Catch patches. IBJJF approved.',
  '附有刺繡 Catch 徽章的頂級黑色競賽道衣，符合 IBJJF 規定。',
  3800,
  FALSE,
  NULL,
  NULL
),
(
  'catch-rash-guard-ls',
  'Catch Long Sleeve Rash Guard',
  'Catch 長袖緊身衣',
  'Competition-grade long sleeve rash guard. Four-way stretch, moisture wicking, UPF50+ protection.',
  '競賽級長袖緊身衣，四向彈力，吸濕排汗，UPF50+ 防曬。',
  1500,
  FALSE,
  NULL,
  NULL
),
(
  'catch-summer-gi-2025',
  'Catch Summer Gi 2025 — Limited Edition',
  'Catch 夏季道衣 2025 — 限定版',
  'Exclusive summer 2025 limited edition gi. Ultra-lightweight single weave. Ships in 4–6 weeks.',
  '2025年夏季限定版超輕量單織道衣，預計4-6週後出貨。',
  4200,
  TRUE,
  'Preorder item — ships in 4–6 weeks. Full payment required to reserve your size.',
  '預購商品 — 預計4-6週後出貨。需全額付款以保留您的尺寸。'
);

INSERT INTO product_variants (product_id, size, color, stock_quantity, sku)
SELECT id, size, 'white', stock, 'CATCH-GI-W-' || size
FROM products,
LATERAL (VALUES ('A1', 8), ('A2', 12), ('A3', 6), ('A4', 3), ('A1L', 4)) AS v(size, stock)
WHERE slug = 'catch-bjj-gi-white';

INSERT INTO product_variants (product_id, size, color, stock_quantity, sku)
SELECT id, size, 'black', stock, 'CATCH-GI-B-' || size
FROM products,
LATERAL (VALUES ('A1', 5), ('A2', 10), ('A3', 7), ('A4', 2), ('A1L', 3)) AS v(size, stock)
WHERE slug = 'catch-bjj-gi-black';

INSERT INTO product_variants (product_id, size, color, stock_quantity, sku)
SELECT id, size, 'black', stock, 'CATCH-RG-LS-' || size
FROM products,
LATERAL (VALUES ('XS', 15), ('S', 20), ('M', 18), ('L', 12), ('XL', 8), ('XXL', 4)) AS v(size, stock)
WHERE slug = 'catch-rash-guard-ls';

INSERT INTO product_variants (product_id, size, color, stock_quantity, sku)
SELECT id, size, 'white', 0, 'CATCH-SG25-W-' || size
FROM products,
LATERAL (VALUES ('A1'), ('A2'), ('A3'), ('A4'), ('A1L')) AS v(size)
WHERE slug = 'catch-summer-gi-2025';
