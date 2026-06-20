CREATE OR REPLACE FUNCTION get_inventory_value(p_tenant_id TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(
    mv.quantity_on_hand * ic.current_cost_local
  ), 0)
  FROM mv_inventory_aggregates_by_sku mv
  JOIN item_costing ic
    ON ic.tenant_id = mv.tenant_id
    AND ic.sku = mv.sku
    AND ic.source_system = 'gp-dynamics'
  WHERE mv.tenant_id = p_tenant_id
    AND ic.current_cost_local > 0
    AND mv.quantity_on_hand > 0;
$$;

CREATE OR REPLACE FUNCTION get_inventory_status_counts(p_tenant_id TEXT)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'critical', COUNT(*) FILTER (
      WHERE mv.quantity_available <= 0 AND ic.annual_demand_units > 0
    ),
    'reorder_needed', COUNT(*) FILTER (
      WHERE mv.quantity_available > 0
        AND mv.reorder_level > 0
        AND mv.quantity_available < mv.reorder_level
        AND ic.annual_demand_units > 0
    ),
    'ok', COUNT(*) FILTER (
      WHERE mv.quantity_available > 0 AND ic.annual_demand_units > 0
    ),
    'no_demand', COUNT(*) FILTER (
      WHERE ic.annual_demand_units = 0 OR ic.annual_demand_units IS NULL
    )
  )
  FROM mv_inventory_aggregates_by_sku mv
  LEFT JOIN item_costing ic
    ON ic.tenant_id = mv.tenant_id
    AND ic.sku = mv.sku
    AND ic.source_system = 'gp-dynamics'
  WHERE mv.tenant_id = p_tenant_id;
$$;

REVOKE ALL ON FUNCTION get_inventory_value(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_inventory_value(TEXT) TO service_role;
REVOKE ALL ON FUNCTION get_inventory_status_counts(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_inventory_status_counts(TEXT) TO service_role;
