#!/usr/bin/env node
/**
 * Applies supabase/migrations/20260614000000_execute_ai_query_fn.sql
 *
 * Usage:
 *   set SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@...supabase.com:5432/postgres
 *   node scripts/apply-execute-ai-query.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error(
    "SUPABASE_DB_URL is required. Copy the Postgres connection string from Supabase Dashboard > Project Settings > Database."
  );
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260614000000_execute_ai_query_fn.sql"
);
const sql = readFileSync(migrationPath, "utf8");

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  await client.query(sql);
  await client.query("NOTIFY pgrst, 'reload schema'");
  console.log("Applied execute_ai_query migration successfully.");
} catch (error) {
  console.error("Failed to apply execute_ai_query migration:", error);
  process.exit(1);
} finally {
  await client.end();
}
