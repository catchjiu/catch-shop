# MATSIDE — E-Commerce Module

High-performance e-commerce built with Next.js 15, Supabase, Zustand, and next-intl.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database/Auth**: Supabase (PostgreSQL + Auth)
- **State Management**: Zustand (cart persistence)
- **i18n**: next-intl (EN + 繁體中文)
- **UI**: Tailwind CSS v4, Shadcn/UI (Radix primitives), Framer Motion
- **Payments**: Manual Bank Transfer + NewebPay MPG

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `NEWEBPAY_MERCHANT_ID` | NewebPay merchant ID |
| `NEWEBPAY_HASH_KEY` | NewebPay AES hash key (32 chars) |
| `NEWEBPAY_HASH_IV` | NewebPay AES hash IV (16 chars) |
| `NEXT_PUBLIC_SITE_URL` | Your site URL (for payment callbacks) |

### 3. Run the Supabase migration

In your Supabase project dashboard, go to **SQL Editor** and paste the contents of:

```
supabase/migrations/0001_shop_schema.sql
```

This creates all tables, RLS policies, the `decrement_stock` function, and seeds sample products.

### 4. Set up an admin user

After running the migration, create a user in Supabase Auth and set their `user_metadata.role` to `"admin"`:

```sql
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(raw_user_meta_data, '{role}', '"admin"')
WHERE email = 'your-admin@email.com';
```

### 5. Start the dev server

```bash
npm run dev
```

Visit:
- **Shop (EN)**: http://localhost:3000/en/shop
- **Shop (中文)**: http://localhost:3000/zh-TW/shop
- **Admin**: http://localhost:3000/admin/shop

## Project Structure

```
src/
├── app/
│   ├── [locale]/           # i18n-prefixed customer routes
│   │   ├── shop/           # Product listing + detail pages
│   │   └── checkout/       # Checkout stepper + success page
│   ├── admin/shop/         # Admin dashboard (no locale prefix)
│   └── api/
│       ├── orders/         # POST /api/orders — create order
│       └── payments/
│           └── newebpay/   # NewebPay callback & return handlers
├── components/
│   ├── shop/               # ProductCard, ProductGrid, CartDrawer, etc.
│   └── ui/                 # Shadcn/Radix UI primitives
├── hooks/
│   └── useCart.ts          # Zustand cart with localStorage persistence
├── lib/
│   ├── supabase/           # Browser + server Supabase clients + types
│   ├── payments/
│   │   └── newebpay.ts     # AES-256-CBC TradeInfo builder
│   └── currency.ts         # formatTWD(amount, locale)
└── i18n/
    ├── messages/
    │   ├── en.json
    │   └── zh-TW.json
    └── routing.ts
```

## Features

### Customer-Facing
- Glassmorphism product cards with Framer Motion entrance animations
- Slide-out cart drawer with real-time stock validation
- Preorder badge + delivery estimate display
- 3-step checkout: Shipping → Payment → Review
- Manual Bank Transfer: shows bank account details on success page
- NewebPay MPG: AES-encrypted redirect to payment gateway
- Preorder checkbox confirmation in Review step
- Guest checkout with post-order account creation CTA
- EN / 繁體中文 language toggle

### Admin (http://localhost:3000/admin/shop)
- **Dashboard**: Revenue KPI, top products, member/guest ratio, recent orders
- **Inventory**: All variants with red row highlighting when stock < 5, inline editable quantity
- **Orders**: Filterable table (All / Preorder / Pending / Completed) with status dropdown

## Database Schema

| Table | Key Columns |
|---|---|
| `products` | `slug`, `name_en`, `name_zh`, `price_twd`, `is_preorder` |
| `product_variants` | `product_id`, `size`, `color`, `stock_quantity`, `sku` |
| `orders` | `user_id`, `guest_email`, `status`, `payment_method`, `total_amount` |
| `order_items` | `order_id`, `variant_id`, `quantity`, `price_at_purchase` |

## NewebPay Integration

The integration uses the NewebPay MPG (Multi-Payment Gateway) API:

1. At checkout, an order is created with `status = pending_payment`
2. `/src/lib/payments/newebpay.ts` builds the AES-256-CBC encrypted `TradeInfo`
3. The encrypted form is submitted to NewebPay's gateway
4. NewebPay POSTs a callback to `/api/payments/newebpay/callback`
5. The callback verifies the SHA-256 hash, then calls `decrement_stock` and updates the order status to `processing`

**Test gateway**: `https://ccore.newebpay.com/MPG/mpg_gateway`  
**Production gateway**: `https://core.newebpay.com/MPG/mpg_gateway`
