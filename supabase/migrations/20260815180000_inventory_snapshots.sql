-- Monthly inventory position snapshots for trend charting.
-- Captures on-hand units + J$ value (matching get_inventory_value) once per month.

CREATE TABLE IF NOT EXISTS public.inventory_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  snapshot_month date NOT NULL,
  total_units_on_hand numeric NOT NULL,
  total_inventory_value_local numeric NOT NULL,
  total_inventory_value_usd numeric NULL,
  distinct_skus integer NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, snapshot_month)
);

CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_tenant_month
  ON public.inventory_snapshots (tenant_id, snapshot_month);

COMMENT ON TABLE public.inventory_snapshots IS
  'Point-in-time monthly inventory totals (units + J$ value). One row per tenant per month; re-capture upserts.';

CREATE OR REPLACE FUNCTION public.capture_inventory_snapshot(p_tenant_id text)
RETURNS public.inventory_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := (date_trunc('month', now()))::date;
  v_row public.inventory_snapshots;
  v_units numeric;
  v_value_local numeric;
  v_value_usd numeric;
  v_skus integer;
BEGIN
  IF p_tenant_id IS NULL OR btrim(p_tenant_id) = '' THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  SELECT
    COALESCE(SUM(mv.quantity_on_hand), 0),
    COUNT(*)::integer
  INTO v_units, v_skus
  FROM mv_inventory_aggregates_by_sku mv
  WHERE mv.tenant_id = p_tenant_id
    AND mv.quantity_on_hand > 0;

  SELECT COALESCE(SUM(mv.quantity_on_hand * ic.current_cost_local), 0)
  INTO v_value_local
  FROM mv_inventory_aggregates_by_sku mv
  JOIN item_costing ic
    ON ic.tenant_id = mv.tenant_id
   AND ic.sku = mv.sku
   AND ic.source_system = 'gp-dynamics'
  WHERE mv.tenant_id = p_tenant_id
    AND ic.current_cost_local > 0
    AND mv.quantity_on_hand > 0;

  SELECT SUM(mv.quantity_on_hand * ic.current_cost_usd)
  INTO v_value_usd
  FROM mv_inventory_aggregates_by_sku mv
  JOIN item_costing ic
    ON ic.tenant_id = mv.tenant_id
   AND ic.sku = mv.sku
   AND ic.source_system = 'gp-dynamics'
  WHERE mv.tenant_id = p_tenant_id
    AND ic.current_cost_usd > 0
    AND mv.quantity_on_hand > 0;

  INSERT INTO public.inventory_snapshots (
    tenant_id,
    snapshot_month,
    total_units_on_hand,
    total_inventory_value_local,
    total_inventory_value_usd,
    distinct_skus,
    captured_at
  )
  VALUES (
    p_tenant_id,
    v_month,
    v_units,
    v_value_local,
    v_value_usd,
    v_skus,
    now()
  )
  ON CONFLICT (tenant_id, snapshot_month)
  DO UPDATE SET
    total_units_on_hand = EXCLUDED.total_units_on_hand,
    total_inventory_value_local = EXCLUDED.total_inventory_value_local,
    total_inventory_value_usd = EXCLUDED.total_inventory_value_usd,
    distinct_skus = EXCLUDED.distinct_skus,
    captured_at = EXCLUDED.captured_at
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_inventory_snapshot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_inventory_snapshot(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.capture_inventory_snapshot(text) TO postgres;

ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_snapshots_service_role_all
  ON public.inventory_snapshots;
CREATE POLICY inventory_snapshots_service_role_all
  ON public.inventory_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS inventory_snapshots_authenticated_select
  ON public.inventory_snapshots;
CREATE POLICY inventory_snapshots_authenticated_select
  ON public.inventory_snapshots
  FOR SELECT
  TO authenticated
  USING (true);

-- Monthly capture after daily GP sync window (~05:00-05:25 UTC).
-- Do not modify existing TropiAd cron jobs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'inventory-monthly-snapshot'
  ) THEN
    PERFORM cron.schedule(
      'inventory-monthly-snapshot',
      '0 6 1 * *',
      $cron$SELECT public.capture_inventory_snapshot('tropical-battery');$cron$
    );
  END IF;
END;
$$;
