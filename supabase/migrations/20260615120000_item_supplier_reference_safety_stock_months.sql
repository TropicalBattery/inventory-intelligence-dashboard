-- Configurable safety stock months for foreign/overseas suppliers (lead time >= 60 days)

ALTER TABLE item_supplier_reference
ADD COLUMN IF NOT EXISTS safety_stock_months numeric DEFAULT 3;

COMMENT ON COLUMN item_supplier_reference.safety_stock_months IS
    'Months of average demand held as safety stock when supplier lead time >= 60 days.';

DROP VIEW IF EXISTS vw_reorder_inputs;

CREATE VIEW vw_reorder_inputs AS
SELECT
    p.tenant_id,
    p.sku,
    p.name,
    p.item_class,
    p.category,
    p.is_active,
    COALESCE(inv.quantity_on_hand, 0) AS quantity_on_hand,
    COALESCE(inv.quantity_available, 0) AS quantity_available,
    COALESCE(inv.quantity_on_order, 0) AS quantity_on_order,
    COALESCE(inv.quantity_in_pipeline, 0) AS quantity_in_pipeline,
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
LEFT JOIN (
    SELECT
        tenant_id,
        sku,
        SUM(quantity_on_hand) AS quantity_on_hand,
        SUM(quantity_available) AS quantity_available,
        SUM(quantity_on_order) AS quantity_on_order,
        SUM(
            COALESCE(quantity_in_transit, 0)
            + COALESCE(quantity_in_bond, 0)
            + COALESCE(quantity_at_port, 0)
            + COALESCE(quantity_in_clearing, 0)
        ) AS quantity_in_pipeline,
        COALESCE(
            MAX(reorder_level) FILTER (WHERE external_id = sku || '-'),
            0
        ) AS reorder_level,
        COALESCE(
            MAX(maximum_stock_level) FILTER (WHERE external_id = sku || '-'),
            0
        ) AS maximum_stock_level
    FROM inventory_balances
    GROUP BY tenant_id, sku
) inv
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
