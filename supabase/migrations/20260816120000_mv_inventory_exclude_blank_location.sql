-- Fix: exclude blank-location aggregate rows from mv_inventory_aggregates_by_sku.
-- inventory_balances stores each SKU twice (blank-location total + per-location
-- detail). Summing both doubled on-hand. Blank rows carry no unique stock.

-- Dependent views must be dropped before the MV can be replaced.
DROP VIEW IF EXISTS public.vw_overstock;
DROP VIEW IF EXISTS public.vw_reorder_inputs;

DROP MATERIALIZED VIEW IF EXISTS public.mv_inventory_aggregates_by_sku;

CREATE MATERIALIZED VIEW public.mv_inventory_aggregates_by_sku AS
SELECT
  tenant_id,
  sku,
  sum(quantity_on_hand) AS quantity_on_hand,
  sum(quantity_available) AS quantity_available,
  sum(quantity_on_order) AS quantity_on_order,
  sum(COALESCE(quantity_in_transit, 0::numeric)) AS quantity_in_transit,
  sum(COALESCE(quantity_in_bond, 0::numeric)) AS quantity_in_bond,
  sum(COALESCE(quantity_at_port, 0::numeric)) AS quantity_at_port,
  sum(COALESCE(quantity_in_clearing, 0::numeric)) AS quantity_in_clearing,
  COALESCE(
    max(reorder_level) FILTER (WHERE external_id = (sku || '-'::text)),
    0::numeric
  ) AS reorder_level,
  COALESCE(
    max(maximum_stock_level) FILTER (WHERE external_id = (sku || '-'::text)),
    0::numeric
  ) AS maximum_stock_level
FROM public.inventory_balances
WHERE location_code IS NOT NULL
  AND btrim(location_code) <> ''
GROUP BY
  tenant_id,
  sku;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX mv_inventory_aggregates_sku_idx
  ON public.mv_inventory_aggregates_by_sku (tenant_id, sku);

COMMENT ON MATERIALIZED VIEW public.mv_inventory_aggregates_by_sku IS
  'Per-SKU inventory aggregates from inventory_balances, excluding blank-location summary rows that duplicate per-location detail.';

-- Recreate dependent reorder inputs view (unchanged definition).
CREATE VIEW public.vw_reorder_inputs AS
SELECT
  p.tenant_id,
  p.sku,
  p.name,
  p.item_class,
  p.category,
  p.is_active,
  COALESCE(inv.quantity_on_hand, 0) AS quantity_on_hand,
  COALESCE(inv.quantity_available, 0) AS quantity_available,
  COALESCE(inv.quantity_on_hand, 0) - COALESCE(inv.quantity_available, 0) AS quantity_allocated,
  COALESCE(inv.quantity_on_order, 0) AS quantity_on_order,
  COALESCE(inv.quantity_in_transit, 0) + COALESCE(isr.qty_in_transit, 0) AS quantity_in_transit,
  COALESCE(inv.quantity_in_bond, 0) + COALESCE(isr.qty_in_bond, 0) AS quantity_in_bond,
  COALESCE(inv.quantity_at_port, 0) + COALESCE(isr.qty_at_port, 0) AS quantity_at_port,
  COALESCE(inv.quantity_in_clearing, 0) + COALESCE(isr.qty_in_clearing, 0) AS quantity_in_clearing,
  COALESCE(inv.quantity_on_hand, 0)
    - (COALESCE(inv.quantity_on_hand, 0) - COALESCE(inv.quantity_available, 0))
    + COALESCE(inv.quantity_in_transit, 0) + COALESCE(isr.qty_in_transit, 0)
    + COALESCE(inv.quantity_in_bond, 0) + COALESCE(isr.qty_in_bond, 0)
    + COALESCE(inv.quantity_at_port, 0) + COALESCE(isr.qty_at_port, 0)
    + COALESCE(inv.quantity_in_clearing, 0) + COALESCE(isr.qty_in_clearing, 0)
    AS effective_available,
  COALESCE(inv.quantity_in_transit, 0) + COALESCE(isr.qty_in_transit, 0)
    + COALESCE(inv.quantity_in_bond, 0) + COALESCE(isr.qty_in_bond, 0)
    + COALESCE(inv.quantity_at_port, 0) + COALESCE(isr.qty_at_port, 0)
    + COALESCE(inv.quantity_in_clearing, 0) + COALESCE(isr.qty_in_clearing, 0)
    AS quantity_in_pipeline,
  inv.reorder_level,
  inv.maximum_stock_level,
  ic.annual_demand_units,
  ic.avg_daily_demand_units,
  ic.unit_cost,
  ic.ic_ordering_cost,
  ic.ic_holding_cost,
  isr.supplier_external_id,
  isr.vendor_item_number,
  isr.lead_time_days,
  isr.safety_stock_months,
  isr.pallet_qty,
  isr.container_qty,
  COALESCE(isr.ordering_cost_per_order, ic.ic_ordering_cost) AS ordering_cost_per_order,
  COALESCE(isr.holding_cost_per_unit_year, ic.ic_holding_cost) AS holding_cost_per_unit_year,
  isr.unit_price AS supplier_unit_price,
  s.name AS supplier_name,
  s.lead_time_days AS supplier_lead_time_days
FROM products p
LEFT JOIN mv_inventory_aggregates_by_sku inv
  ON inv.tenant_id = p.tenant_id
 AND inv.sku = p.sku
LEFT JOIN LATERAL (
  SELECT
    ic_inner.annual_demand_units,
    ic_inner.avg_daily_demand_units,
    ic_inner.current_cost_local AS unit_cost,
    ic_inner.ordering_cost_per_order AS ic_ordering_cost,
    ic_inner.holding_cost_per_unit_year AS ic_holding_cost
  FROM item_costing ic_inner
  WHERE ic_inner.tenant_id = p.tenant_id
    AND (
      (ic_inner.sku IS NOT NULL AND ic_inner.sku = p.sku)
      OR (
        ic_inner.product_external_id IS NOT NULL
        AND ic_inner.product_external_id = p.external_id
      )
    )
  ORDER BY ic_inner.source_updated_at DESC NULLS LAST
  LIMIT 1
) ic ON true
LEFT JOIN LATERAL (
  SELECT
    isr_inner.supplier_external_id,
    isr_inner.vendor_item_number,
    isr_inner.lead_time_days,
    isr_inner.safety_stock_months,
    isr_inner.qty_in_transit,
    isr_inner.qty_in_bond,
    isr_inner.qty_at_port,
    isr_inner.qty_in_clearing,
    isr_inner.pallet_qty,
    isr_inner.container_qty,
    isr_inner.ordering_cost_per_order,
    isr_inner.holding_cost_per_unit_year,
    isr_inner.unit_price
  FROM item_supplier_reference isr_inner
  WHERE isr_inner.tenant_id = p.tenant_id
    AND isr_inner.sku = p.sku
  ORDER BY
    isr_inner.is_priority_vendor DESC,
    isr_inner.unit_price ASC NULLS LAST,
    isr_inner.supplier_external_id ASC
  LIMIT 1
) isr ON true
LEFT JOIN suppliers s
  ON s.tenant_id = p.tenant_id
 AND s.external_id = isr.supplier_external_id;

COMMENT ON VIEW public.vw_reorder_inputs IS
  'Reorder inputs per SKU. Inventory from mv_inventory_aggregates_by_sku. Pipeline qty combines GP inventory with manual item_supplier_reference values from the primary supplier.';

-- Recreate overstock view (unchanged definition; depends on vw_reorder_inputs).
CREATE VIEW public.vw_overstock AS
WITH base AS (
  SELECT
    r.tenant_id,
    r.sku,
    r.name AS product_name,
    r.quantity_available,
    r.quantity_on_hand - r.quantity_allocated + r.quantity_in_pipeline AS stock_position,
    CASE
      WHEN r.annual_demand_units > 0::numeric THEN r.annual_demand_units / 12.0
      WHEN r.avg_daily_demand_units > 0::numeric THEN r.avg_daily_demand_units * 30.44
      ELSE NULL::numeric
    END AS avg_monthly_demand,
    r.unit_cost
  FROM vw_reorder_inputs r
  WHERE r.annual_demand_units > 0::numeric
)
SELECT
  tenant_id,
  sku,
  product_name,
  quantity_available,
  stock_position,
  avg_monthly_demand,
  stock_position / avg_monthly_demand AS months_of_cover,
  GREATEST(0::numeric, stock_position - avg_monthly_demand * 6::numeric) AS excess_units,
  GREATEST(0::numeric, stock_position - avg_monthly_demand * 6::numeric) * unit_cost AS excess_value_local
FROM base b
WHERE avg_monthly_demand IS NOT NULL
  AND avg_monthly_demand > 0::numeric
  AND (stock_position / avg_monthly_demand) > 6::numeric
ORDER BY (GREATEST(0::numeric, stock_position - avg_monthly_demand * 6::numeric) * unit_cost) DESC;

-- Ensure concurrent refresh path still works after recreate.
SELECT public.refresh_inventory_aggregates();
