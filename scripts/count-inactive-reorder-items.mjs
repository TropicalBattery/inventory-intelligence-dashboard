#!/usr/bin/env node
/**
 * Reports how many reorder rows are classified as inactive vs previously critical.
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

function isPositive(value) {
  return value !== null && value !== undefined && Number(value) > 0;
}

function hasReorderActivitySignals(row) {
  return (
    isPositive(row.annual_demand_units) ||
    isPositive(row.reorder_level) ||
    isPositive(row.quantity_on_hand) ||
    isPositive(row.quantity_on_order) ||
    isPositive(row.current_cost_local)
  );
}

function classifyLegacyCritical(row) {
  const quantityAvailable = Number(row.quantity_available ?? 0);
  const quantityOnOrder = Number(row.quantity_on_order ?? 0);
  return quantityAvailable <= 0 || quantityAvailable + quantityOnOrder <= 0;
}

function classifyNewStatus(row) {
  if (!hasReorderActivitySignals(row)) {
    return "inactive";
  }

  if (classifyLegacyCritical(row)) {
    return "critical";
  }

  return "actionable-other";
}

const env = loadEnvLocal();
const tenantId = env.TENANT_ID ?? "tropical-battery";
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from("vw_reorder_inputs")
  .select("*")
  .eq("tenant_id", tenantId);

if (error) {
  console.error("Failed to fetch reorder inputs:", error.message);
  process.exit(1);
}

const rows = data ?? [];
const inactiveRows = rows.filter((row) => classifyNewStatus(row) === "inactive");
const movedFromCritical = inactiveRows.filter((row) => classifyLegacyCritical(row));

console.log(`Total reorder rows: ${rows.length}`);
console.log(`Inactive - No Activity: ${inactiveRows.length}`);
console.log(`Moved from legacy Critical to Inactive: ${movedFromCritical.length}`);

const sampleSkus = movedFromCritical
  .slice(0, 10)
  .map((row) => `${row.sku}${row.name ? ` - ${row.name}` : ""}`);

if (sampleSkus.length > 0) {
  console.log("Sample moved SKUs:");
  for (const sample of sampleSkus) {
    console.log(`  - ${sample}`);
  }
}
