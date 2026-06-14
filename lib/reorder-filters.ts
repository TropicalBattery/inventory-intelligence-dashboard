import type { ReorderRecommendation } from "@/lib/types";

export function countInactiveRecommendations(
  recommendations: ReorderRecommendation[]
): number {
  return recommendations.filter((rec) => rec.status === "inactive").length;
}

export function filterVisibleRecommendations(
  recommendations: ReorderRecommendation[],
  showInactiveItems: boolean
): ReorderRecommendation[] {
  if (showInactiveItems) {
    return recommendations;
  }

  return recommendations.filter((rec) => rec.status !== "inactive");
}

export function isActionableReorderStatus(
  status: ReorderRecommendation["status"]
): boolean {
  return status === "critical" || status === "reorder";
}
