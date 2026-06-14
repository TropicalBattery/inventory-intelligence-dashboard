-- Dashboard PO fields: memo and sent timestamp

ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS memo text;

ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS sent_at timestamptz;
