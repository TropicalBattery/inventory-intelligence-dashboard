-- PO vendor-lock override: durable audit + line stamp columns.
-- Inventory project: qunnxsxeevoeflqfrzwz
-- Additive only. Back up before applying.
--
-- RLS for po_lock_overrides mirrors po_audit_log:
--   ENABLE RLS
--   authenticated SELECT WHERE tenant_id = 'tropical-battery'
--   service_role ALL (USING true / WITH CHECK true)

-- ---------------------------------------------------------------------------
-- STEP 1 - Durable audit table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.po_lock_overrides (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         text NOT NULL,
  sku               text NOT NULL,
  original_vendor   text NOT NULL,
  override_vendor   text NOT NULL,
  reason            text NOT NULL,
  overridden_by     text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_lock_overrides_tenant_sku
  ON public.po_lock_overrides (tenant_id, sku, created_at DESC);

ALTER TABLE public.po_lock_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY po_lock_overrides_authenticated_select
    ON public.po_lock_overrides
    FOR SELECT
    TO authenticated
    USING (tenant_id = 'tropical-battery');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY po_lock_overrides_service_role_all
    ON public.po_lock_overrides
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.po_lock_overrides IS
  'Append-only audit of approver vendor-lock breaks on PO cart lines. Survives cart clear and PO cancel.';

-- ---------------------------------------------------------------------------
-- STEP 2 - Stamp columns on cart lines
-- ---------------------------------------------------------------------------
ALTER TABLE public.po_cart_items
  ADD COLUMN IF NOT EXISTS lock_override_reason  text,
  ADD COLUMN IF NOT EXISTS lock_overridden_by    text,
  ADD COLUMN IF NOT EXISTS lock_overridden_at    timestamptz,
  ADD COLUMN IF NOT EXISTS lock_original_vendor  text;

COMMENT ON COLUMN public.po_cart_items.lock_override_reason IS
  'Approver reason when vendor_lock was overridden for this cart line.';
COMMENT ON COLUMN public.po_cart_items.lock_overridden_by IS
  'Approver email who overrode vendor_lock for this cart line.';
COMMENT ON COLUMN public.po_cart_items.lock_overridden_at IS
  'When vendor_lock was overridden for this cart line.';
COMMENT ON COLUMN public.po_cart_items.lock_original_vendor IS
  'locked_vendor_id that was overridden (original lock).';

-- ---------------------------------------------------------------------------
-- STEP 3 - Stamp columns on final PO lines (survive submit)
-- ---------------------------------------------------------------------------
ALTER TABLE public.purchase_order_lines
  ADD COLUMN IF NOT EXISTS lock_override_reason  text,
  ADD COLUMN IF NOT EXISTS lock_overridden_by    text,
  ADD COLUMN IF NOT EXISTS lock_overridden_at    timestamptz,
  ADD COLUMN IF NOT EXISTS lock_original_vendor  text;

COMMENT ON COLUMN public.purchase_order_lines.lock_override_reason IS
  'Copied from cart: approver reason for vendor_lock override.';
COMMENT ON COLUMN public.purchase_order_lines.lock_overridden_by IS
  'Copied from cart: approver email for vendor_lock override.';
COMMENT ON COLUMN public.purchase_order_lines.lock_overridden_at IS
  'Copied from cart: when vendor_lock was overridden.';
COMMENT ON COLUMN public.purchase_order_lines.lock_original_vendor IS
  'Copied from cart: locked_vendor_id that was overridden.';
