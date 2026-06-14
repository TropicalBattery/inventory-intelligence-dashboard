#!/usr/bin/env node
/**
 * Verifies draft_po_selections write/read flow against the configured Supabase project.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
  if (!existsSync(envPath)) {
    throw new Error(".env.local not found");
  }

  return Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split("\n")
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      })
  );
}

const env = loadEnvLocal();
const tenantId = env.TENANT_ID ?? "tropical-battery";
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const batchId = crypto.randomUUID();
const testRows = [
  {
    batch_id: batchId,
    tenant_id: tenantId,
    sku: "96MA807L",
    supplier_external_id: null,
    suggested_qty: 12,
  },
];

const { error: insertError } = await supabase
  .from("draft_po_selections")
  .insert(testRows);

if (insertError) {
  console.error("Insert failed:", insertError.message);
  process.exit(1);
}

const { data: rows, error: selectError } = await supabase
  .from("draft_po_selections")
  .select("sku, supplier_external_id, suggested_qty")
  .eq("tenant_id", tenantId)
  .eq("batch_id", batchId);

if (selectError) {
  console.error("Select failed:", selectError.message);
  process.exit(1);
}

if (!rows || rows.length !== 1 || rows[0].sku !== "96MA807L") {
  console.error("Unexpected read result:", rows);
  process.exit(1);
}

await supabase
  .from("draft_po_selections")
  .delete()
  .eq("tenant_id", tenantId)
  .eq("batch_id", batchId);

console.log("draft_po_selections flow OK");
console.log(`batch_id=${batchId}`);
