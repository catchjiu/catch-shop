-- MATSIDE — Add color_image_url to product_variants
-- Run this in your Supabase SQL editor

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS color_image_url TEXT DEFAULT NULL;
