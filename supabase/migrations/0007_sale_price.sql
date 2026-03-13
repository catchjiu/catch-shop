-- Add compare_at_price_twd to products (the "was" price shown crossed out)
-- When set and greater than price_twd, the product is considered "on sale"
ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_price_twd INTEGER;
