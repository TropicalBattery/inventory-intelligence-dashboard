import { readFileSync } from "fs";
import { fetchAllReorderInputRows } from "../lib/queries/reorder-inputs.ts";
import { buildReorderRecommendation } from "../lib/reorder-engine.ts";
import {
  classifyRecommendationsByTab,
  countReorderTabAttention,
} from "../lib/reorder-tab-classification.ts";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    })
);

process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
process.env.TENANT_ID = env.TENANT_ID;

const rows = await fetchAllReorderInputRows();
const recs = rows.map((row) => buildReorderRecommendation(row));
const beforeCritical = recs.filter((row) => row.status === "critical").length;
const beforeReorder = recs.filter((row) => row.status === "reorder").length;
const classified = classifyRecommendationsByTab(recs);
const afterCritical = classified.reorderAction.filter(
  (row) => row.status === "critical"
).length;
const afterReorder = classified.reorderAction.filter(
  (row) => row.status === "reorder"
).length;
const afterAttention = countReorderTabAttention(classified.reorderAction);

console.log(
  JSON.stringify(
    {
      total: recs.length,
      before: {
        critical: beforeCritical,
        reorder: beforeReorder,
        needAttention: beforeCritical + beforeReorder,
      },
      tabs: {
        reorderAction: {
          skus: classified.reorderAction.length,
          critical: afterCritical,
          reorder: afterReorder,
          needAttention: afterAttention,
        },
        nonStock: classified.nonStock.length,
        unclassified: classified.unclassified.length,
      },
    },
    null,
    2
  )
);
