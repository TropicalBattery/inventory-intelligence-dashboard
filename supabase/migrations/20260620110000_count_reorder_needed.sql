CREATE OR REPLACE FUNCTION count_reorder_needed(p_tenant_id TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM mv_inventory_aggregates_by_sku
  WHERE tenant_id = p_tenant_id
    AND quantity_available > 0
    AND reorder_level > 0
    AND quantity_available < reorder_level;
$$;

REVOKE ALL ON FUNCTION count_reorder_needed(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION count_reorder_needed(TEXT) TO service_role;
