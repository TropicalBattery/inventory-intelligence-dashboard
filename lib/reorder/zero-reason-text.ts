import type {
  ReorderRecommendation,
  SuggestedQtyZeroReason,
} from "@/lib/types";

export type ZeroReasonText = {
  short: string;
  detail: string;
};

const BANNER_REASON_LABEL: Record<SuggestedQtyZeroReason, string> = {
  already_covered: "already covered",
  no_demand: "no demand data",
  no_target: "can't calculate",
  blocked_rule: "ordering off",
};

function formatUnits(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  });
}

function formatYearsOfSupply(years: number): string {
  return years.toLocaleString("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: years < 10 && years % 1 !== 0 ? 1 : 0,
  });
}

function blockedRuleLabel(
  ruleType: "discontinue" | "do_not_buy" | string | undefined
): string {
  if (ruleType === "discontinue") {
    return "do not reorder (discontinued)";
  }
  if (ruleType === "do_not_buy") {
    return "do not buy";
  }
  return "ordering off";
}

function alreadyCoveredDetail(
  rec: Pick<
    ReorderRecommendation,
    "annualDemandUnits" | "quantityOnOrder"
  >
): string {
  if (!(rec.quantityOnOrder > 0)) {
    return "Current stock already covers the reorder point, so no reorder is needed.";
  }

  const annual = rec.annualDemandUnits;
  const onOrder = formatUnits(rec.quantityOnOrder);

  if (annual !== null && annual > 0) {
    const years = rec.quantityOnOrder / annual;
    return `About ${formatUnits(annual)}/yr sold and ${onOrder} already on order (~${formatYearsOfSupply(years)} yrs of supply). Position already exceeds the reorder point, so no reorder is needed.`;
  }

  return `${onOrder} already on order. Position already exceeds the reorder point, so no reorder is needed.`;
}

/**
 * Plain-English short label + detail for why suggested qty is 0 / blocked.
 * Returns null when suggestedQtyZeroReason is null (real positive qty).
 */
export function getZeroReasonText(
  rec: Pick<
    ReorderRecommendation,
    | "suggestedQtyZeroReason"
    | "annualDemandUnits"
    | "quantityOnOrder"
    | "purchaseRule"
  >
): ZeroReasonText | null {
  const reason = rec.suggestedQtyZeroReason;
  if (reason === null) {
    return null;
  }

  switch (reason) {
    case "already_covered":
      return {
        short: "Already covered",
        detail: alreadyCoveredDetail(rec),
      };
    case "no_demand":
      return {
        short: "No demand data",
        detail:
          "No sales history on record, so a quantity can't be calculated. Enter one manually if you know the demand.",
      };
    case "no_target":
      return {
        short: "Can't calculate",
        detail:
          "Demand exists but cost/lead-time inputs are missing, so a target can't be computed. Enter a quantity manually if needed.",
      };
    case "blocked_rule":
      return {
        short: "Ordering off",
        detail: `This item is marked '${blockedRuleLabel(rec.purchaseRule?.ruleType)}', so ordering is turned off.`,
      };
    default:
      return null;
  }
}

/**
 * One-line bulk-add exclusion summary from selected rows that were filtered out.
 * Example: "3 items excluded: 2 already covered, 1 ordering off."
 */
export function formatZeroReasonExclusionSummary(
  excluded: Array<
    Pick<ReorderRecommendation, "suggestedQtyZeroReason">
  >
): string | null {
  if (excluded.length === 0) {
    return null;
  }

  const counts = new Map<SuggestedQtyZeroReason, number>();
  for (const row of excluded) {
    const reason = row.suggestedQtyZeroReason;
    if (!reason) {
      continue;
    }
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  const total = excluded.length;
  const itemWord = total === 1 ? "item" : "items";
  const entries = Array.from(counts.entries());

  if (entries.length === 0) {
    return `${total} ${itemWord} excluded: need a suggested quantity greater than 0 (blocked purchase rules are excluded)`;
  }

  if (entries.length === 1) {
    const [reason, count] = entries[0]!;
    const label = BANNER_REASON_LABEL[reason];
    // Single reason type: "2 items excluded: already covered"
    if (count === total) {
      return `${total} ${itemWord} excluded: ${label}`;
    }
  }

  const parts = entries.map(([reason, count]) => {
    const label = BANNER_REASON_LABEL[reason];
    return `${count} ${label}`;
  });

  return `${total} ${itemWord} excluded: ${parts.join(", ")}.`;
}
