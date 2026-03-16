-- Allow individual variants to have their own price (e.g. Kids Gi cheaper than Adult Gi)
-- When NULL, the product's base price_twd is used instead
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS price_override INTEGER;
