import { DashboardBottomSection } from "@/components/dashboard/dashboard-bottom-section";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { DashboardMetricCards } from "@/components/dashboard/dashboard-metric-cards";
import { SeasonalIntelligenceCard } from "@/components/dashboard/seasonal-intelligence-card";
import { getRecentSyncRuns } from "@/lib/queries/connector-health";
import { getDashboardStats } from "@/lib/queries/dashboard";
import { getPurchaseOrderList } from "@/lib/queries/purchase-orders";
import { getLatestSeasonalIntelligence } from "@/lib/seasonality/service";
import {
  formatRelativeTimeShort,
  getSyncAgeTone,
} from "@/lib/format";
import type { ConnectorSyncStatus } from "@/lib/types/database";

import type { DashboardStatusCounts } from "@/lib/queries/dashboard";

function buildStatusData(counts: DashboardStatusCounts) {
  return [
    { name: "Critical", value: counts.critical, color: "#CC2B2B" },
    { name: "Watch", value: counts.watch, color: "#185FA5" },
    { name: "OK", value: counts.ok, color: "#16A34A" },
  ];
}

function buildStockStatusNote(counts: DashboardStatusCounts): string | null {
  if (counts.no_demand <= 0) {
    return null;
  }

  return `${counts.no_demand.toLocaleString("en-JM")} SKUs with no recent demand not shown`;
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

export default async function DashboardPage() {
  const [stats, orders, syncRuns, seasonalIntelligence] = await Promise.all([
    getDashboardStats(),
    getPurchaseOrderList(),
    getRecentSyncRuns(),
    getLatestSeasonalIntelligence(),
  ]);

  return (
    <div className="space-y-5">
      <DashboardMetricCards
        totalSkus={stats.totalSkus}
        totalInventoryValue={stats.totalInventoryValue}
        itemsBelowReorderLevel={stats.itemsBelowReorderLevel}
        criticalCount={stats.criticalCount}
      />

      <SeasonalIntelligenceCard initialRecord={seasonalIntelligence} />

      <DashboardCharts
        statusData={buildStatusData(stats.statusCounts)}
        stockStatusNote={buildStockStatusNote(stats.statusCounts)}
        totalSkus={stats.totalSkus}
        topDemand={stats.topDemand}
        categoryValue={stats.categoryValue}
        syncActivity={buildSyncActivity(syncRuns)}
      />

      <DashboardBottomSection
        recentOrders={orders.slice(0, 5)}
        criticalItems={stats.criticalItems}
      />
    </div>
  );
}
