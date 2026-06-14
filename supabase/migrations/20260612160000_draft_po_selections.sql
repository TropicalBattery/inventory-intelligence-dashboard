-- Draft PO selections: temporary storage between reorder page and PO generation

CREATE TABLE IF NOT EXISTS draft_po_selections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid NOT NULL,
    tenant_id text NOT NULL,
    sku text NOT NULL,
    supplier_external_id text,
    suggested_qty numeric NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_draft_po_selections_batch
    ON draft_po_selections (batch_id, tenant_id);

ALTER TABLE draft_po_selections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY draft_po_selections_authenticated_all
        ON draft_po_selections
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY draft_po_selections_service_role_all
        ON draft_po_selections
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
