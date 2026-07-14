import {
  isNonStockClass,
  isReorderableClass,
} from "@/lib/item-class-config";
import { selectOverstockRecommendations } from "@/lib/reorder/overstock";
import type { ReorderRecommendation } from "@/lib/types";

export type ReorderPageTab =
  | "reorder"
  | "overstock"
  | "nonstock"
  | "unclassified";

export type ClassifiedReorderRecommendations = {
  reorderAction: ReorderRecommendation[];
  nonStock: ReorderRecommendation[];
  unclassified: ReorderRecommendation[];
};

export type ReorderTabCounts = {
  reorderActionTotal: number;
  reorderActionNeedAttention: number;
  overstockTotal: number;
  nonStockTotal: number;
  unclassifiedTotal: number;
};

export function classifyRecommendationTab(
  recommendation: ReorderRecommendation
): ReorderPageTab {
  if (isReorderableClass(recommendation.itemClass)) {
    return "reorder";
  }

  if (isNonStockClass(recommendation.itemClass)) {
    return "nonstock";
  }

  return "unclassified";
}

export function classifyRecommendationsByTab(
  recommendations: ReorderRecommendation[]
): ClassifiedReorderRecommendations {
  const reorderAction: ReorderRecommendation[] = [];
  const nonStock: ReorderRecommendation[] = [];
  const unclassified: ReorderRecommendation[] = [];

  for (const recommendation of recommendations) {
    const tab = classifyRecommendationTab(recommendation);

    if (tab === "reorder") {
      reorderAction.push(recommendation);
    } else if (tab === "nonstock") {
      nonStock.push(recommendation);
    } else {
      unclassified.push(recommendation);
    }
  }

  return { reorderAction, nonStock, unclassified };
}

export function countReorderTabAttention(
  recommendations: ReorderRecommendation[]
): number {
  return recommendations.filter(
    (rec) => rec.status === "critical" || rec.status === "watch"
  ).length;
}

/** Soft filter: Action / Overstock show whitelisted SKUs only. */
export function selectWhitelistedReorderAction(
  recommendations: ReorderRecommendation[]
): ReorderRecommendation[] {
  return recommendations.filter((rec) => rec.isWhitelisted);
}

export function buildReorderTabCounts(
  classified: ClassifiedReorderRecommendations
): ReorderTabCounts {
  const reorderAction = selectWhitelistedReorderAction(classified.reorderAction);

  return {
    reorderActionTotal: reorderAction.length,
    reorderActionNeedAttention: countReorderTabAttention(reorderAction),
    overstockTotal: selectOverstockRecommendations(reorderAction).length,
    nonStockTotal: classified.nonStock.length,
    unclassifiedTotal: classified.unclassified.length,
  };
}

export function parseReorderPageTab(
  value: string | null | undefined
): ReorderPageTab {
  if (
    value === "nonstock" ||
    value === "unclassified" ||
    value === "reorder" ||
    value === "overstock"
  ) {
    return value;
  }

  return "reorder";
}
