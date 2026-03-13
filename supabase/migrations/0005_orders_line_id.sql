-- Add optional LINE ID field to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS line_id TEXT;
