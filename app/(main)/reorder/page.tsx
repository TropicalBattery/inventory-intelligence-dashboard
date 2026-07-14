import { Suspense } from "react";
import { ReorderRecommendations } from "@/components/reorder/reorder-recommendations";
import { getLastSuccessfulInventoryBalancesSyncAt } from "@/lib/connector/health";
import { classifyRecommendationsByTab } from "@/lib/reorder-tab-classification";
import { getActiveInventoryWhitelist } from "@/lib/queries/active-inventory-whitelist";
import { getRecentSyncRuns } from "@/lib/queries/connector-health";
import { getSupplierFilterOptions } from "@/lib/queries/suppliers";
import { getReorderRecommendations } from "@/lib/queries/reorder";
import {
  buildVelocityDiagnosticMap,
  getVelocityRowsBySku,
} from "@/lib/queries/velocity";
import { getSeasonalityProfilesBySku } from "@/lib/seasonality/service";
import { TENANT_ID } from "@/lib/tenant";

function ReorderPageFallback() {
  return (
    <div className="rounded-2xl border border-transparent shadow-card bg-white px-6 py-10 text-sm text-slate-600">
      Loading reorder recommendations...
    </div>
  );
}

export default async function ReorderPage() {
  const [
    recommendations,
    velocityBySku,
    syncRuns,
    whitelist,
    supplierFilterOptions,
  ] = await Promise.all([
    getReorderRecommendations(TENANT_ID),
    getVelocityRowsBySku(),
    getRecentSyncRuns(),
    getActiveInventoryWhitelist(),
    getSupplierFilterOptions(),
  ]);

  const classified = classifyRecommendationsByTab(recommendations);
  const diagnosticsBySku = buildVelocityDiagnosticMap(
    recommendations,
    velocityBySku
  );
  const seasonalityBySku = await getSeasonalityProfilesBySku(
    classified.reorderAction.map((rec) => rec.sku)
  );
  const lastInventorySyncAt =
    getLastSuccessfulInventoryBalancesSyncAt(syncRuns);

  return (
    <Suspense fallback={<ReorderPageFallback />}>
      <ReorderRecommendations
        classified={classified}
        diagnosticsBySku={Object.fromEntries(diagnosticsBySku.entries())}
        velocityBySku={Object.fromEntries(velocityBySku.entries())}
        seasonalityBySku={Object.fromEntries(seasonalityBySku.entries())}
        lastInventorySyncAt={lastInventorySyncAt}
        activeInventorySkuCount={
          whitelist.isActive ? whitelist.skuCount : null
        }
        supplierFilterOptions={supplierFilterOptions}
      />
    </Suspense>
  );
}
