import type { SupplierReference, SupplierReliabilityRating } from "@/lib/types";

const RELIABILITY_RANK: Record<SupplierReliabilityRating, number> = {
  Preferred: 0,
  Approved: 1,
  Conditional: 2,
};

function reliabilitySortRank(
  rating: SupplierReliabilityRating | null | undefined
): number {
  if (!rating) {
    return 99;
  }

  return RELIABILITY_RANK[rating] ?? 50;
}

function nullableNumberSort(
  left: number | null | undefined,
  right: number | null | undefined
): number {
  const leftValue = left ?? Number.POSITIVE_INFINITY;
  const rightValue = right ?? Number.POSITIVE_INFINITY;
  return leftValue - rightValue;
}

export function sortSupplierReferencesForComparison(
  suppliers: SupplierReference[]
): SupplierReference[] {
  return [...suppliers].sort((left, right) => {
    const leftHasQuote = left.hasQuoteOnFile !== false;
    const rightHasQuote = right.hasQuoteOnFile !== false;
    if (leftHasQuote !== rightHasQuote) {
      return leftHasQuote ? -1 : 1;
    }

    const reliabilityDiff =
      reliabilitySortRank(left.reliabilityRating) -
      reliabilitySortRank(right.reliabilityRating);
    if (reliabilityDiff !== 0) {
      return reliabilityDiff;
    }

    const leadTimeDiff = nullableNumberSort(
      left.leadTimeDays,
      right.leadTimeDays
    );
    if (leadTimeDiff !== 0) {
      return leadTimeDiff;
    }

    return nullableNumberSort(left.unitPrice, right.unitPrice);
  });
}
