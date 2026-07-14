-- Monthly sales aggregation for stockout-adjusted demand (DATA-02).
-- Aggregate in Postgres; consumers filter to DEMAND_WINDOW_MONTHS in app code.
-- Columns confirmed: sales_transactions.transaction_date, quantity_sold.

CREATE OR REPLACE VIEW vw_monthly_sales_by_sku AS
SELECT
  tenant_id,
  sku,
  date_trunc('month', transaction_date) AS sales_month,
  SUM(COALESCE(quantity_sold, 0)) AS units
FROM sales_transactions
WHERE sku IS NOT NULL
  AND transaction_date IS NOT NULL
GROUP BY
  tenant_id,
  sku,
  date_trunc('month', transaction_date);

COMMENT ON VIEW vw_monthly_sales_by_sku IS
  'Calendar-month units sold per SKU for selling-months demand adjustment';
