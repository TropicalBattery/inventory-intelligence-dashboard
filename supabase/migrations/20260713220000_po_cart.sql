-- Persistent PO cart (bulk PO per supplier) + PO audit column
-- Run manually in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.po_cart_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  created_by text NOT NULL,
  sku text NOT NULL,
  product_name text NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  supplier_external_id text NULL,
  unit_price numeric NULL,
  currency text NULL DEFAULT 'USD',
  source_status text NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT po_cart_items_pkey PRIMARY KEY (id),
  CONSTRAINT po_cart_items_user_sku_key UNIQUE (tenant_id, created_by, sku)
);

CREATE INDEX IF NOT EXISTS idx_po_cart_user
  ON public.po_cart_items (tenant_id, created_by);

ALTER TABLE public.po_cart_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY po_cart_items_authenticated_all
    ON public.po_cart_items
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY po_cart_items_service_role_all
    ON public.po_cart_items
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Audit: who submitted the draft PO from the cart (and other dashboard flows).
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS created_by text NULL;

COMMENT ON TABLE public.po_cart_items IS
  'Per-user PO cart. One row per SKU per user; supplier_external_id null = UNASSIGNED.';

COMMENT ON COLUMN public.purchase_orders.created_by IS
  'Authenticated user email that created the PO (po-cart / dashboard).';

-- NOTE: draft_po_selections is no longer used by the app (retired in
-- favor of po_cart_items). Table left in place; safe to drop later.
