-- Performance indexes for tenant-scoped queries across main tables

CREATE INDEX IF NOT EXISTS idx_products_tenant_sku
ON products(tenant_id, sku);

CREATE INDEX IF NOT EXISTS idx_inventory_balances_tenant_item
ON inventory_balances(tenant_id, sku);

CREATE INDEX IF NOT EXISTS idx_inventory_balances_tenant_location
ON inventory_balances(tenant_id, location_code);

CREATE INDEX IF NOT EXISTS idx_sales_transactions_tenant_item_date
ON sales_transactions(tenant_id, sku, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_item_costing_tenant_item
ON item_costing(tenant_id, sku);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_date
ON purchase_orders(tenant_id, po_date DESC);
