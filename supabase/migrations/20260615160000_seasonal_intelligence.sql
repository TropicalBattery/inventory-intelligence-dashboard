-- Seasonal demand analysis: monthly patterns, item_costing profiles, AI intelligence store

CREATE OR REPLACE FUNCTION get_monthly_demand_by_sku(p_tenant_id TEXT)
RETURNS TABLE (
    item_number TEXT,
    item_description TEXT,
    item_class TEXT,
    month_num INTEGER,
    month_name TEXT,
    avg_monthly_qty NUMERIC,
    seasonality_index NUMERIC
)
LANGUAGE sql
STABLE
AS $$
    WITH sku_month_totals AS (
        SELECT
            st.tenant_id,
            st.sku,
            EXTRACT(MONTH FROM st.transaction_date)::INTEGER AS month_num,
            TO_CHAR(st.transaction_date, 'Mon') AS month_name,
            SUM(COALESCE(st.quantity_sold, 0)) AS month_qty
        FROM sales_transactions st
        WHERE st.tenant_id = p_tenant_id
            AND st.sku IS NOT NULL
            AND st.transaction_date >= NOW() - INTERVAL '13 months'
        GROUP BY
            st.tenant_id,
            st.sku,
            DATE_TRUNC('month', st.transaction_date),
            EXTRACT(MONTH FROM st.transaction_date),
            TO_CHAR(st.transaction_date, 'Mon')
    ),
    sku_calendar_month_avg AS (
        SELECT
            tenant_id,
            sku,
            month_num,
            MIN(month_name) AS month_name,
            AVG(month_qty) AS avg_monthly_qty
        FROM sku_month_totals
        GROUP BY tenant_id, sku, month_num
    ),
    sku_overall AS (
        SELECT
            scma.tenant_id,
            scma.sku,
            AVG(scma.avg_monthly_qty) AS overall_avg
        FROM sku_calendar_month_avg scma
        GROUP BY scma.tenant_id, scma.sku
    )
    SELECT
        p.sku AS item_number,
        p.name AS item_description,
        p.item_class,
        scma.month_num,
        scma.month_name,
        ROUND(scma.avg_monthly_qty, 2) AS avg_monthly_qty,
        ROUND(
            scma.avg_monthly_qty / NULLIF(so.overall_avg, 0),
            4
        ) AS seasonality_index
    FROM sku_calendar_month_avg scma
    JOIN products p
        ON p.tenant_id = scma.tenant_id
        AND p.sku = scma.sku
    JOIN sku_overall so
        ON so.tenant_id = scma.tenant_id
        AND so.sku = scma.sku
    WHERE scma.tenant_id = p_tenant_id
    ORDER BY p.sku, scma.month_num;
$$;

ALTER TABLE item_costing
    ADD COLUMN IF NOT EXISTS seasonality_profile JSONB;

ALTER TABLE item_costing
    ADD COLUMN IF NOT EXISTS peak_months INTEGER[];

ALTER TABLE item_costing
    ADD COLUMN IF NOT EXISTS seasonality_strength TEXT;

CREATE TABLE IF NOT EXISTS seasonal_intelligence (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL,
    analysis_date timestamptz NOT NULL DEFAULT now(),
    seasonal_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
    spike_skus jsonb NOT NULL DEFAULT '[]'::jsonb,
    summary text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seasonal_intelligence_tenant_date
    ON seasonal_intelligence (tenant_id, analysis_date DESC);

ALTER TABLE seasonal_intelligence ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY seasonal_intelligence_authenticated_all
        ON seasonal_intelligence
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY seasonal_intelligence_service_role_all
        ON seasonal_intelligence
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
