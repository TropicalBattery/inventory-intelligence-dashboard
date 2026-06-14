-- Cached AI-generated explanations to avoid repeat API calls

CREATE TABLE IF NOT EXISTS ai_explanations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL,
    sku text,
    explanation_type text NOT NULL,
    input_hash text NOT NULL,
    explanation text NOT NULL,
    generated_at timestamptz DEFAULT now(),
    UNIQUE (tenant_id, explanation_type, input_hash, sku)
);

CREATE INDEX IF NOT EXISTS idx_ai_explanations_lookup
    ON ai_explanations (tenant_id, explanation_type, sku, input_hash);

ALTER TABLE ai_explanations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY ai_explanations_authenticated_all
        ON ai_explanations
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY ai_explanations_service_role_all
        ON ai_explanations
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
