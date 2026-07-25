-- Inbound containers: manual entry + arrived status.
-- Run manually in Supabase SQL editor.
--
-- entry_source: 'upload' (xlsx refresh) | 'manual' (in-app entry)
-- status:       'inbound' | 'arrived'
-- Upload refresh replaces ONLY (source_month, entry_source='upload')
-- and never touches entry_source='manual' rows.

ALTER TABLE public.inbound_containers
  ADD COLUMN IF NOT EXISTS entry_source text NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'inbound',
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS created_by text NULL,
  ADD COLUMN IF NOT EXISTS updated_by text NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NULL DEFAULT now();

-- Backfill any pre-existing rows (DEFAULT already covers NOT NULL columns,
-- but keep arrived_at / audit fields explicit for clarity).
UPDATE public.inbound_containers
SET
  entry_source = COALESCE(entry_source, 'upload'),
  status = COALESCE(status, 'inbound')
WHERE entry_source IS NULL
   OR status IS NULL;

DO $$ BEGIN
  ALTER TABLE public.inbound_containers
    ADD CONSTRAINT inbound_containers_entry_source_check
    CHECK (entry_source IN ('upload', 'manual'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.inbound_containers
    ADD CONSTRAINT inbound_containers_status_check
    CHECK (status IN ('inbound', 'arrived'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_inbound_containers_month_entry_source
  ON public.inbound_containers (tenant_id, source_month, entry_source);

CREATE INDEX IF NOT EXISTS idx_inbound_containers_status
  ON public.inbound_containers (tenant_id, status);
