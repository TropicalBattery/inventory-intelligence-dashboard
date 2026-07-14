export type AbcClass = "A" | "B" | "C" | null;

/** Cumulative annual-value share cutoff for class A (Pareto head). */
export const ABC_A_CUTOFF = 0.8;

/** Cumulative annual-value share cutoff for class B (mid). */
export const ABC_B_CUTOFF = 0.95;

export type AbcClassInput = {
  sku: string;
  annualDemandUnits: number | null;
  unitCost: number | null;
};

/**
 * Assign ABC classes by annual sales value across the whole set
 * (relative ranking, not absolute thresholds).
 *
 * annualValue = annualDemandUnits * unitCost. Items missing either
 * positive value are omitted from ranking and map to null.
 *
 * Walking highest value first, class uses cumulative share *before*
 * adding the SKU: fill A until prior share reaches ABC_A_CUTOFF, then
 * B until ABC_B_CUTOFF, then C.
 */
export function assignAbcClasses(
  recs: AbcClassInput[]
): Map<string, AbcClass> {
  const result = new Map<string, AbcClass>();

  for (const rec of recs) {
    result.set(rec.sku, null);
  }

  const valued = recs
    .map((rec) => {
      const demand = rec.annualDemandUnits;
      const cost = rec.unitCost;
      if (
        demand === null ||
        demand === undefined ||
        cost === null ||
        cost === undefined ||
        demand <= 0 ||
        cost <= 0
      ) {
        return null;
      }

      return { sku: rec.sku, annualValue: demand * cost };
    })
    .filter((row): row is { sku: string; annualValue: number } => row !== null)
    .sort((left, right) => right.annualValue - left.annualValue);

  const totalValue = valued.reduce((sum, row) => sum + row.annualValue, 0);
  if (totalValue <= 0) {
    return result;
  }

  let cumulative = 0;

  for (const row of valued) {
    const shareBefore = cumulative / totalValue;
    cumulative += row.annualValue;

    // Class is decided by share before this SKU joins, so the item that
    // crosses a cutoff still belongs to the band it was filling.
    if (shareBefore < ABC_A_CUTOFF) {
      result.set(row.sku, "A");
    } else if (shareBefore < ABC_B_CUTOFF) {
      result.set(row.sku, "B");
    } else {
      result.set(row.sku, "C");
    }
  }

  return result;
}

export function getAbcBadgeClassName(
  abcClass: Exclude<AbcClass, null>
): string {
  switch (abcClass) {
    case "A":
      return "bg-[#111111] text-white text-xs font-bold rounded px-1.5 py-0.5";
    case "B":
      return "bg-[#6B7280] text-white text-xs font-bold rounded px-1.5 py-0.5";
    case "C":
      return "bg-[#E5E7EB] text-[#6B7280] text-xs font-bold rounded px-1.5 py-0.5";
  }
}

export function getAbcClassDescription(
  abcClass: Exclude<AbcClass, null>
): string {
  switch (abcClass) {
    case "A":
      return "Top sellers - tightest service level";
    case "B":
      return "Mid movers";
    case "C":
      return "Long tail";
  }
}
