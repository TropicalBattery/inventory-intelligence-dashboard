-- Allow authenticated dashboard users to read inventory_balances for per-location views

DO $$ BEGIN
    CREATE POLICY inventory_balances_authenticated_select
        ON inventory_balances
        FOR SELECT
        TO authenticated
        USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE POLICY inventory_balances_service_role_all
        ON inventory_balances
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
