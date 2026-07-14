-- PO approval audit trail.
-- Run manually in Supabase SQL editor.
--
-- NOTE: No backfill of 'created' rows for existing cart POs.
-- Historical drafts predate the audit log.

CREATE TABLE IF NOT EXISTS public.po_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  po_id uuid NOT NULL,
  po_number text NULL,
  action text NOT NULL,
  from_status text NULL,
  to_status text NULL,
  actor text NOT NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT po_audit_log_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_po_audit_po
  ON public.po_audit_log (tenant_id, po_id, created_at);

ALTER TABLE public.po_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY po_audit_log_authenticated_select
    ON public.po_audit_log
    FOR SELECT
    TO authenticated
    USING (tenant_id = 'tropical-battery');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY po_audit_log_service_role_all
    ON public.po_audit_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.po_audit_log IS
  'Append-only PO approval / status transition audit trail.';
