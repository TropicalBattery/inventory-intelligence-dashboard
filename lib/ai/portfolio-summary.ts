import type { PortfolioSummaryPayload } from "@/lib/ai/prompts";
import type { ReorderRecommendation, VelocityDiagnostic } from "@/lib/types";

function getLineTotal(rec: ReorderRecommendation): number | null {
  if (rec.unitCost === null || rec.unitCost === undefined) {
    return null;
  }

  return rec.suggestedQtyRounded * rec.unitCost;
}

function hasHighSeverityStockoutFlag(diagnostic: VelocityDiagnostic): boolean {
  return diagnostic.mismatchFlags.some(
    (flag) =>
      flag.severity === "high" &&
      (flag.type === "accelerating_insufficient_cover" ||
        flag.type === "critical_days_of_cover")
  );
}

function hasDeceleratingExcessIncomingFlag(
  diagnostic: VelocityDiagnostic
): boolean {
  return diagnostic.mismatchFlags.some(
    (flag) => flag.type === "decelerating_excess_incoming"
  );
}

function isDeadStockCandidate(
  rec: ReorderRecommendation,
  diagnostic: VelocityDiagnostic
): boolean {
  return (
    rec.quantityAvailable > 0 &&
    diagnostic.unitsSoldLast30d === 0 &&
    diagnostic.unitsSold31To60d === 0
  );
}

export function computePortfolioVelocityAggregates(
  recommendations: ReorderRecommendation[],
  diagnosticsBySku: Map<string, VelocityDiagnostic>
): PortfolioSummaryPayload["velocityAggregates"] {
  let acceleratingStockoutRiskCount = 0;
  let deceleratingOverstockRiskCount = 0;
  let deadStockCount = 0;
  let deadStockTiedUpValue = 0;

  for (const rec of recommendations) {
    const diagnostic = diagnosticsBySku.get(rec.sku);

    if (!diagnostic) {
      continue;
    }

    if (
      diagnostic.trend === "accelerating" &&
      hasHighSeverityStockoutFlag(diagnostic)
    ) {
      acceleratingStockoutRiskCount += 1;
    }

    if (
      diagnostic.trend === "decelerating" &&
      hasDeceleratingExcessIncomingFlag(diagnostic)
    ) {
      deceleratingOverstockRiskCount += 1;
    }

    if (isDeadStockCandidate(rec, diagnostic)) {
      deadStockCount += 1;

      if (rec.unitCost !== null && rec.unitCost !== undefined) {
        deadStockTiedUpValue += rec.quantityAvailable * rec.unitCost;
      }
    }
  }

  return {
    acceleratingStockoutRiskCount,
    deceleratingOverstockRiskCount,
    deadStockCount,
    deadStockTiedUpValue: Math.round(deadStockTiedUpValue * 100) / 100,
  };
}

export function buildPortfolioSummaryPayload(
  recommendations: ReorderRecommendation[],
  diagnosticsBySku: Map<string, VelocityDiagnostic>,
  filterDescription: string
): PortfolioSummaryPayload {
  const statusCounts = recommendations.reduce(
    (counts, rec) => {
      if (rec.status === "no_demand") {
        return counts;
      }

      if (rec.status === "critical") {
        counts.critical += 1;
      } else if (rec.status === "watch") {
        counts.watch += 1;
      } else if (rec.status === "reorder_needed") {
        counts.reorder += 1;
      } else if (rec.status === "ok") {
        counts.ok += 1;
      }

      return counts;
    },
    { critical: 0, watch: 0, reorder: 0, ok: 0 }
  );

  const criticalItems = recommendations
    .filter((rec) => rec.status === "critical")
    .map((rec) => ({
      rec,
      lineTotal: getLineTotal(rec),
    }))
    .sort((left, right) => (right.lineTotal ?? 0) - (left.lineTotal ?? 0));

  const criticalLineValueTotal = criticalItems.reduce(
    (sum, item) => sum + (item.lineTotal ?? 0),
    0
  );

  const topCriticalItems = criticalItems.slice(0, 5).map(({ rec, lineTotal }) => ({
    sku: rec.sku,
    name: rec.name,
    supplierName: rec.supplierName,
    suggestedQtyRounded: rec.suggestedQtyRounded,
    lineTotal,
  }));

  const supplierCounts = new Map<string, number>();

  for (const rec of recommendations) {
    if (rec.status !== "critical" && rec.status !== "watch" && rec.status !== "reorder_needed") {
      continue;
    }

    if (!rec.supplierName) {
      continue;
    }

    supplierCounts.set(
      rec.supplierName,
      (supplierCounts.get(rec.supplierName) ?? 0) + 1
    );
  }

  const supplierReorderCounts = Array.from(supplierCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([supplierName, count]) => ({ supplierName, count }))
    .sort((left, right) => right.count - left.count);

  return {
    filterDescription,
    statusCounts,
    criticalLineValueTotal: Math.round(criticalLineValueTotal * 100) / 100,
    topCriticalItems,
    supplierReorderCounts,
    velocityAggregates: computePortfolioVelocityAggregates(
      recommendations,
      diagnosticsBySku
    ),
  };
}
