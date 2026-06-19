import { DashboardBottomSection } from "@/components/dashboard/dashboard-bottom-section";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { DashboardMetricCards } from "@/components/dashboard/dashboard-metric-cards";
import { SeasonalIntelligenceCard } from "@/components/dashboard/seasonal-intelligence-card";
import { getRecentSyncRuns } from "@/lib/queries/connector-health";
import { getDashboardData } from "@/lib/queries/dashboard";
import { getPurchaseOrderList } from "@/lib/queries/purchase-orders";
import { getReorderRecommendations } from "@/lib/queries/reorder";
import { getLatestSeasonalIntelligence } from "@/lib/seasonality/service";
import {
  formatRelativeTimeShort,
  getSyncAgeTone,
} from "@/lib/format";
import type { ReorderRecommendation } from "@/lib/types";
import type { ConnectorSyncStatus } from "@/lib/types/database";

function buildStatusData(recommendations: ReorderRecommendation[]) {
  const counts = {
    critical: 0,
    reorder: 0,
    ok: 0,
    inactive: 0,
  };

  for (const rec of recommendations) {
    counts[rec.status] += 1;
  }

  return [
    { name: "Critical", value: counts.critical, color: "#CC2B2B" },
    { name: "Reorder Needed", value: counts.reorder, color: "#F5A000" },
    { name: "OK", value: counts.ok, color: "#16A34A" },
    { name: "Inactive", value: counts.inactive, color: "#9CA3AF" },
  ];
}

function buildTopDemand(recommendations: ReorderRecommendation[]) {
  return recommendations
    .filter((rec) => (rec.annualDemandUnits ?? 0) > 0)
    .sort(
      (left, right) =>
        (right.annualDemandUnits ?? 0) - (left.annualDemandUnits ?? 0)
    )
    .slice(0, 10)
    .map((rec) => ({
      sku: rec.sku,
      name: rec.name ?? rec.sku,
      demand: rec.annualDemandUnits ?? 0,
    }));
}

function buildCategoryValue(recommendations: ReorderRecommendation[]) {
  const totals = new Map<string, number>();

  for (const rec of recommendations) {
    const category = rec.category?.trim() || "Uncategorized";
    const value = rec.quantityOnHand * (rec.unitCost ?? 0);
    totals.set(category, (totals.get(category) ?? 0) + value);
  }

  return Array.from(totals.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([category, value]) => ({ category, value }));
}

function buildSyncActivity(syncRuns: ConnectorSyncStatus[]) {
  const latestByJob = new Map<string, ConnectorSyncStatus>();

  for (const run of syncRuns) {
    const jobName = run.job_name ?? "Unknown";
    if (!latestByJob.has(jobName)) {
      latestByJob.set(jobName, run);
    }
  }

  return Array.from(latestByJob.entries())
    .slice(0, 8)
    .map(([entity, run]) => {
      const timestamp = run.completed_at ?? run.started_at;
      return {
        entity: entity || "Unknown",
        relativeTime: formatRelativeTimeShort(timestamp),
        tone: getSyncAgeTone(timestamp),
      };
    });
}

function buildCriticalItems(recommendations: ReorderRecommendation[]) {
  return recommendations
    .filter(
      (rec) =>
        rec.status === "critical" &&
        rec.quantityOnHand === 0 &&
        rec.isActive !== false
    )
    .slice(0, 5);
}

export default async function DashboardPage() {
  const [data, recommendations, orders, syncRuns, seasonalIntelligence] =
    await Promise.all([
    getDashboardData(),
    getReorderRecommendations(),
    getPurchaseOrderList(),
    getRecentSyncRuns(),
    getLatestSeasonalIntelligence(),
  ]);

  const criticalCount = recommendations.filter(
    (rec) => rec.status === "critical"
  ).length;

  return (
    <div className="space-y-5">
      <DashboardMetricCards
        totalSkus={data.totalSkus}
        totalInventoryValue={data.totalInventoryValue}
        itemsBelowReorderLevel={data.itemsBelowReorderLevel}
        criticalCount={criticalCount}
      />

      <SeasonalIntelligenceCard initialRecord={seasonalIntelligence} />

      <DashboardCharts
        statusData={buildStatusData(recommendations)}
        totalSkus={data.totalSkus}
        topDemand={buildTopDemand(recommendations)}
        categoryValue={buildCategoryValue(recommendations)}
        syncActivity={buildSyncActivity(syncRuns)}
      />

      <DashboardBottomSection
        recentOrders={orders.slice(0, 5)}
        criticalItems={buildCriticalItems(recommendations)}
      />
    </div>
  );
}
