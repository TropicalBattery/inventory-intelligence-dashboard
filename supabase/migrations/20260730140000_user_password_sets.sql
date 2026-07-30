-- Admin password-set audit (who set whose password, never the password).
-- Inventory project: qunnxsxeevoeflqfrzwz
-- Additive only.
--
-- RLS mirrors po_lock_overrides / po_audit_log:
--   ENABLE RLS
--   authenticated SELECT WHERE tenant_id = 'tropical-battery'
--   service_role ALL (USING true / WITH CHECK true)

CREATE TABLE IF NOT EXISTS public.user_password_sets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     text NOT NULL,
  target_email  text NOT NULL,
  set_by        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_password_sets_tenant_target
  ON public.user_password_sets (tenant_id, target_email, created_at DESC);

ALTER TABLE public.user_password_sets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY user_password_sets_authenticated_select
    ON public.user_password_sets
    FOR SELECT
    TO authenticated
    USING (tenant_id = 'tropical-battery');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY user_password_sets_service_role_all
    ON public.user_password_sets
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.user_password_sets IS
  'Append-only audit of approver-set passwords. Stores who/whom/when only — never the password.';
