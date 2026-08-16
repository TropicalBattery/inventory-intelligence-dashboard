-- Tenant-level monthly sales totals for dashboard MoM chart.
-- Aggregate in Postgres; consumers filter completed months in app code.

CREATE OR REPLACE VIEW public.vw_monthly_sales_total AS
SELECT
  tenant_id,
  sales_month,
  SUM(units) AS units
FROM public.vw_monthly_sales_by_sku
GROUP BY
  tenant_id,
  sales_month;

COMMENT ON VIEW public.vw_monthly_sales_total IS
  'Calendar-month units sold summed across all SKUs per tenant.';
