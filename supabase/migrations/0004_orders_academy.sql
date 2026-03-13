-- Add optional academy field to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS academy TEXT;
