#!/usr/bin/env node
/**
 * Applies supabase/migrations/20260612200000_vw_sales_velocity.sql to the linked database.
 *
 * Usage:
 *   set SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@...supabase.com:5432/postgres
 *   node scripts/apply-vw-sales-velocity.mjs
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
  "20260612200000_vw_sales_velocity.sql"
);
const sql = readFileSync(migrationPath, "utf8");

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  await client.query(sql);
  console.log("Applied vw_sales_velocity migration successfully.");
} catch (error) {
  console.error("Failed to apply vw_sales_velocity migration:", error);
  process.exit(1);
} finally {
  await client.end();
}
