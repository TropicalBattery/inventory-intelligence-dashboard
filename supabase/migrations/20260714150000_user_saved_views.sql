-- FEAT-08: per-user saved / default filter views
-- Run manually in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.user_saved_views (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  created_by text NOT NULL,
  page text NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_saved_views_pkey PRIMARY KEY (id),
  CONSTRAINT user_saved_views_name_key UNIQUE (tenant_id, created_by, page, name)
);

CREATE INDEX IF NOT EXISTS idx_user_saved_views_user_page
  ON public.user_saved_views (tenant_id, created_by, page);

-- At most one default view per user + page.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_saved_views_one_default
  ON public.user_saved_views (tenant_id, created_by, page)
  WHERE is_default;

ALTER TABLE public.user_saved_views ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY user_saved_views_authenticated_all
    ON public.user_saved_views
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY user_saved_views_service_role_all
    ON public.user_saved_views
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.user_saved_views IS
  'FEAT-08: Named filter snapshots per authenticated user (email). page e.g. reorder_action.';
