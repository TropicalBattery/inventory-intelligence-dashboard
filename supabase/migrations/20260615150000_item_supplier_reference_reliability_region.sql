-- Supplier comparison fields for reorder buyer decisions

ALTER TABLE item_supplier_reference
ADD COLUMN IF NOT EXISTS reliability_rating text,
ADD COLUMN IF NOT EXISTS supplier_region text,
ADD COLUMN IF NOT EXISTS min_order_qty integer;

DO $$ BEGIN
    ALTER TABLE item_supplier_reference
        ADD CONSTRAINT item_supplier_reference_reliability_rating_check
        CHECK (
            reliability_rating IS NULL
            OR reliability_rating IN ('Preferred', 'Approved', 'Conditional')
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN item_supplier_reference.reliability_rating IS
    'Buyer-facing supplier reliability: Preferred, Approved, or Conditional.';
COMMENT ON COLUMN item_supplier_reference.supplier_region IS
    'Supplier origin region e.g. Korea, Ecuador, Trinidad, Local.';
COMMENT ON COLUMN item_supplier_reference.min_order_qty IS
    'Minimum order quantity for this SKU from the supplier.';
