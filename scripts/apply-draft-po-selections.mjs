#!/usr/bin/env node
/**
 * Applies supabase/migrations/20260612160000_draft_po_selections.sql to the linked database.
 *
 * Usage (either env var works):
 *   set SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 *   node scripts/apply-draft-po-selections.mjs
 *
 * Or add SUPABASE_DB_URL or SUPABASE_DB_PASSWORD to .env.local
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

function loadEnvLocal() {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function resolveConnectionString() {
  if (process.env.SUPABASE_DB_URL) {
    return process.env.SUPABASE_DB_URL;
  }

  const password = process.env.SUPABASE_DB_PASSWORD;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!password || !supabaseUrl) {
    return null;
  }

  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  const host = process.env.SUPABASE_DB_HOST ?? `aws-0-us-east-1.pooler.supabase.com`;
  const port = process.env.SUPABASE_DB_PORT ?? "6543";

  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${host}:${port}/postgres`;
}

loadEnvLocal();

const connectionString = resolveConnectionString();

if (!connectionString) {
  console.error(
    "SUPABASE_DB_URL or SUPABASE_DB_PASSWORD (+ NEXT_PUBLIC_SUPABASE_URL) is required."
  );
  console.error(
    "Copy the Postgres connection string from Supabase Dashboard > Project Settings > Database."
  );
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260612160000_draft_po_selections.sql"
);
const sql = readFileSync(migrationPath, "utf8");

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  await client.query(sql);
  console.log("Applied draft_po_selections migration successfully.");
} catch (error) {
  console.error("Failed to apply draft_po_selections migration:", error);
  process.exit(1);
} finally {
  await client.end();
}
