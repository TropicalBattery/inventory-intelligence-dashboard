-- Item supplier reference data for reorder and costing inputs

CREATE TABLE IF NOT EXISTS item_supplier_reference (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL,
    sku text NOT NULL,
    supplier_external_id text NOT NULL,
    vendor_item_number text,
    lead_time_days numeric,
    pallet_qty numeric,
    container_qty numeric,
    is_priority_vendor boolean DEFAULT false,
    ordering_cost_per_order numeric,
    holding_cost_per_unit_year numeric,
    unit_price numeric,
    currency text DEFAULT 'JMD',
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (tenant_id, sku, supplier_external_id)
);

CREATE INDEX IF NOT EXISTS idx_item_supplier_reference_tenant_sku
    ON item_supplier_reference (tenant_id, sku);

ALTER TABLE item_supplier_reference ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY item_supplier_reference_authenticated_all
        ON item_supplier_reference
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY item_supplier_reference_service_role_all
        ON item_supplier_reference
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
