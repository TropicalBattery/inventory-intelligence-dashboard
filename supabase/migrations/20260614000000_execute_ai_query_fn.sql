CREATE OR REPLACE FUNCTION execute_ai_query(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  IF upper(trim(query)) NOT SIMILAR TO 'SELECT%' THEN
    RAISE EXCEPTION 'Only SELECT queries are permitted';
  END IF;

  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query || ') t'
  INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION execute_ai_query(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION execute_ai_query(text) TO service_role;
