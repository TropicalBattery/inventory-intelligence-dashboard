-- Sales velocity and trend diagnostics: one row per SKU per tenant

DROP VIEW IF EXISTS vw_sales_velocity;

CREATE VIEW vw_sales_velocity AS
SELECT
    p.tenant_id,
    p.sku,
    COALESCE(sales.units_sold_last_30d, 0) AS units_sold_last_30d,
    COALESCE(sales.units_sold_31_60d, 0) AS units_sold_31_60d,
    COALESCE(sales.units_sold_61_90d, 0) AS units_sold_61_90d,
    COALESCE(sales.units_sold_trailing_12m, 0) AS units_sold_trailing_12m,
    (
        COALESCE(sales.units_sold_last_30d, 0)
        + COALESCE(sales.units_sold_31_60d, 0)
        + COALESCE(sales.units_sold_61_90d, 0)
    ) / 3.0 AS avg_monthly_last_3m,
    COALESCE(sales.units_sold_trailing_12m, 0) / 12.0 AS avg_monthly_trailing_12m,
    CASE
        WHEN COALESCE(sales.units_sold_trailing_12m, 0) = 0 THEN NULL
        ELSE (
            (
                (
                    COALESCE(sales.units_sold_last_30d, 0)
                    + COALESCE(sales.units_sold_31_60d, 0)
                    + COALESCE(sales.units_sold_61_90d, 0)
                ) / 3.0
                - (COALESCE(sales.units_sold_trailing_12m, 0) / 12.0)
            )
            / (COALESCE(sales.units_sold_trailing_12m, 0) / 12.0)
        ) * 100
    END AS velocity_trend_pct,
    sales.last_sale_date,
    CASE
        WHEN sales.last_sale_date IS NULL THEN NULL
        ELSE (CURRENT_DATE - sales.last_sale_date::date)
    END AS days_since_last_sale
FROM products p
LEFT JOIN (
    SELECT
        tenant_id,
        sku,
        SUM(
            CASE
                WHEN transaction_date >= (NOW() - INTERVAL '30 days')
                    THEN COALESCE(quantity_sold, 0)
                ELSE 0
            END
        ) AS units_sold_last_30d,
        SUM(
            CASE
                WHEN transaction_date >= (NOW() - INTERVAL '60 days')
                    AND transaction_date < (NOW() - INTERVAL '30 days')
                    THEN COALESCE(quantity_sold, 0)
                ELSE 0
            END
        ) AS units_sold_31_60d,
        SUM(
            CASE
                WHEN transaction_date >= (NOW() - INTERVAL '90 days')
                    AND transaction_date < (NOW() - INTERVAL '60 days')
                    THEN COALESCE(quantity_sold, 0)
                ELSE 0
            END
        ) AS units_sold_61_90d,
        SUM(
            CASE
                WHEN transaction_date >= (NOW() - INTERVAL '365 days')
                    THEN COALESCE(quantity_sold, 0)
                ELSE 0
            END
        ) AS units_sold_trailing_12m,
        MAX(transaction_date) AS last_sale_date
    FROM sales_transactions
    WHERE sku IS NOT NULL
    GROUP BY tenant_id, sku
) sales
    ON sales.tenant_id = p.tenant_id
    AND sales.sku = p.sku
WHERE p.sku IS NOT NULL;
