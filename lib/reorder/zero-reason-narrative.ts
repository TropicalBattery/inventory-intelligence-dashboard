import type { ReorderRecommendation } from "@/lib/types";

function formatUnits(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  });
}

function supplyPhrase(supplyDuration: number): string {
  if (supplyDuration < 1) {
    return `about ${Math.round(supplyDuration * 12)} months of supply`;
  }
  if (supplyDuration <= 20) {
    return `about ${Math.round(supplyDuration)} years of supply`;
  }
  return "far more than you'll sell in years";
}

function readableBlockedRule(
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

function alreadyCoveredNarrative(
  rec: Pick<
    ReorderRecommendation,
    "annualDemandUnits" | "quantityOnOrder"
  >
): string {
  if (!(rec.quantityOnOrder > 0)) {
    return "Current stock already exceeds the reorder point, so the system recommends ordering none right now.";
  }

  const annual = rec.annualDemandUnits;
  const onOrder = rec.quantityOnOrder.toLocaleString("en-US");

  if (annual !== null && annual > 0) {
    const supplyDuration = rec.quantityOnOrder / annual;
    const phrase = supplyPhrase(supplyDuration);
    return `This item sells around ${formatUnits(annual)} units a year. There are already ${onOrder} on order, ${phrase} at the current sales pace. Its stock position already exceeds the reorder point, so the system recommends ordering none. The 'Critical' status looks urgent because it only reflects stock physically on the shelf right now and ignores the order already on its way.`;
  }

  return `There are already ${onOrder} on order. Its stock position already exceeds the reorder point, so the system recommends ordering none. The 'Critical' status looks urgent because it only reflects stock physically on the shelf right now and ignores the order already on its way.`;
}

/**
 * Full plain-English paragraph for why suggested qty is 0 / blocked.
 * Returns null when suggestedQtyZeroReason is null.
 */
export function getZeroReasonNarrative(
  rec: Pick<
    ReorderRecommendation,
    | "suggestedQtyZeroReason"
    | "annualDemandUnits"
    | "quantityOnOrder"
    | "purchaseRule"
  >
): string | null {
  const reason = rec.suggestedQtyZeroReason;
  if (reason === null) {
    return null;
  }

  switch (reason) {
    case "already_covered":
      return alreadyCoveredNarrative(rec);
    case "no_demand":
      return "There's no sales history on record for this item, so the system has no demand to work from and can't calculate a suggested quantity. Items with no demand history can be reviewed manually if you know they sell. Otherwise it's safe to leave it, since ordering into unknown demand is how overstock builds up.";
    case "no_target":
      return "This item has demand on record, but it's missing the cost or lead-time inputs the system needs to work out an economic order quantity. Without those it can't compute a target, so no quantity is suggested. It's worth flagging the missing cost or lead-time data so future runs can calculate it.";
    case "blocked_rule":
      return `This item is flagged '${readableBlockedRule(rec.purchaseRule?.ruleType)}', so ordering is deliberately turned off regardless of stock levels. The system won't suggest a quantity for it. If this flag is wrong, it needs to be changed at the source in the purchase rules, not here.`;
    default:
      return null;
  }
}
