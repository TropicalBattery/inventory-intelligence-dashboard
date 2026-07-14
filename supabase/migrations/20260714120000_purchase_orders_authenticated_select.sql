-- Allow authenticated dashboard users to read shared PO headers for the
-- pilot tenant. Writes stay service-role / existing policies only.
-- Run manually in Supabase SQL editor.
--
-- Runtime audit (2026-07-14): RLS is enabled on purchase_orders.
-- Authenticated SELECT returned 0 of 9 rows; service_role sees all.
-- Insert as authenticated failed with 42501 (no permissive write path).
-- No SELECT policy for authenticated existed in-repo migrations.

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY purchase_orders_authenticated_select_tenant
    ON public.purchase_orders
    FOR SELECT
    TO authenticated
    USING (tenant_id = 'tropical-battery');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON POLICY purchase_orders_authenticated_select_tenant
  ON public.purchase_orders IS
  'Tenant-shared PO headers: any signed-in tropical-battery user may read.';
