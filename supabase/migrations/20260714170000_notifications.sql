-- In-app notifications for PO approval events.
-- Run manually in Supabase SQL editor.
--
-- NOTE: Role-targeted rows (recipient_role set) are visible to all
-- authenticated users via RLS; the app filters by the viewer's role.
-- Acceptable for the two-role (buyer / approver) model.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  recipient_role text NULL,
  recipient_email text NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NULL,
  link text NULL,
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_created
  ON public.notifications (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_email
  ON public.notifications (tenant_id, recipient_email, created_at DESC)
  WHERE recipient_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_role
  ON public.notifications (tenant_id, recipient_role, created_at DESC)
  WHERE recipient_role IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY notifications_authenticated_select
    ON public.notifications
    FOR SELECT
    TO authenticated
    USING (
      tenant_id = 'tropical-battery'
      AND (
        recipient_email = (auth.jwt() ->> 'email')
        OR recipient_role IS NOT NULL
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY notifications_service_role_all
    ON public.notifications
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.notifications IS
  'In-app notifications for PO approval workflow (pending / approved / suppressed).';
