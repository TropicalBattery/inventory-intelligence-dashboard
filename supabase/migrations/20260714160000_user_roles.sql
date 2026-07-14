-- Buyer / approver roles for PO approval.
-- Run manually in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('buyer', 'approver')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_tenant_email_key UNIQUE (tenant_id, email)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY user_roles_authenticated_select
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (tenant_id = 'tropical-battery');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY user_roles_service_all
    ON public.user_roles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed the current account as approver so nothing locks up.
INSERT INTO public.user_roles (tenant_id, email, role)
VALUES ('tropical-battery', 'admin@tropicalbattery.test', 'approver')
ON CONFLICT (tenant_id, email) DO NOTHING;

COMMENT ON TABLE public.user_roles IS
  'Buyer / approver roles for PO approval workflow. Unknown emails default to buyer in app code.';
