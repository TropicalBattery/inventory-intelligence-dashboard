import type { ReorderRecommendation, ReorderStatus } from "@/lib/types";

export type ReorderStatusSummary = Record<ReorderStatus, number>;

const EMPTY_STATUS_SUMMARY: ReorderStatusSummary = {
  critical: 0,
  watch: 0,
  reorder_needed: 0,
  ok: 0,
  no_demand: 0,
};

export function countNoDemandRecommendations(
  recommendations: ReorderRecommendation[]
): number {
  return recommendations.filter((rec) => rec.status === "no_demand").length;
}

export function filterMainRecommendations(
  recommendations: ReorderRecommendation[]
): ReorderRecommendation[] {
  return recommendations.filter((rec) => rec.status !== "no_demand");
}

export function filterNoDemandRecommendations(
  recommendations: ReorderRecommendation[]
): ReorderRecommendation[] {
  return recommendations.filter((rec) => rec.status === "no_demand");
}

export function isActionableReorderStatus(
  status: ReorderRecommendation["status"]
): boolean {
  return status === "critical" || status === "watch";
}

export function summarizeReorderStatuses(
  recommendations: ReorderRecommendation[]
): ReorderStatusSummary {
  const summary = { ...EMPTY_STATUS_SUMMARY };

  for (const rec of recommendations) {
    summary[rec.status] += 1;
  }

  return summary;
}

export function sortReorderActionRows(
  rows: ReorderRecommendation[]
): ReorderRecommendation[] {
  const statusOrder: Record<ReorderStatus, number> = {
    critical: 0,
    watch: 1,
    reorder_needed: 2,
    ok: 3,
    no_demand: 4,
  };

  return [...rows].sort((left, right) => {
    const statusDiff = statusOrder[left.status] - statusOrder[right.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    if (left.status === "critical" || left.status === "ok") {
      return (
        (right.annualDemandUnits ?? 0) - (left.annualDemandUnits ?? 0)
      );
    }

    if (left.status === "watch") {
      return (right.reorderLevel ?? 0) - (left.reorderLevel ?? 0);
    }

    return left.sku.localeCompare(right.sku);
  });
}

/** @deprecated Use countNoDemandRecommendations */
export function countInactiveRecommendations(
  recommendations: ReorderRecommendation[]
): number {
  return countNoDemandRecommendations(recommendations);
}

/** @deprecated Use filterMainRecommendations */
export function filterVisibleRecommendations(
  recommendations: ReorderRecommendation[],
  showNoDemandItems: boolean
): ReorderRecommendation[] {
  if (showNoDemandItems) {
    return recommendations;
  }

  return filterMainRecommendations(recommendations);
}
