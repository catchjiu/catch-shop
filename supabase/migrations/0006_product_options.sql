-- Product options (e.g. "Item": Rash Guard / Shorts / Both)
ALTER TABLE products ADD COLUMN IF NOT EXISTS options JSONB;

-- Store chosen options on each order item
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selected_options JSONB;
