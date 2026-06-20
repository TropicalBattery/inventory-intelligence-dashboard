CREATE OR REPLACE FUNCTION get_category_value(p_tenant_id TEXT)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    json_agg(
      json_build_object('category', category, 'value', value)
      ORDER BY value DESC
    ),
    '[]'::json
  )
  FROM (
    SELECT
      COALESCE(NULLIF(TRIM(p.category), ''), 'Uncategorized') AS category,
      SUM(mv.quantity_on_hand * ic.current_cost_local) AS value
    FROM mv_inventory_aggregates_by_sku mv
    JOIN item_costing ic
      ON ic.tenant_id = mv.tenant_id
      AND ic.sku = mv.sku
      AND ic.source_system = 'gp-dynamics'
    LEFT JOIN products p
      ON p.tenant_id = mv.tenant_id
      AND p.sku = mv.sku
    WHERE mv.tenant_id = p_tenant_id
      AND ic.current_cost_local > 0
      AND mv.quantity_on_hand > 0
    GROUP BY 1
    ORDER BY value DESC
    LIMIT 8
  ) grouped;
$$;

REVOKE ALL ON FUNCTION get_category_value(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_category_value(TEXT) TO service_role;
