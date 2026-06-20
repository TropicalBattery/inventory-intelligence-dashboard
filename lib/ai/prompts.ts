import {
  NO_EM_DASH_INSTRUCTION,
  NO_RECALCULATE_INSTRUCTION,
} from "@/lib/ai/config";
import type { ReorderRecommendation, VelocityDiagnostic } from "@/lib/types";

function formatDate(date: Date | null): string {
  if (!date) {
    return "unknown";
  }

  return date.toISOString().slice(0, 10);
}

function formatNullableNumber(value: number | null, suffix = ""): string {
  if (value === null || value === undefined) {
    return "unknown";
  }

  return `${value.toLocaleString("en-JM")}${suffix}`;
}

function formatTrendLabel(trend: VelocityDiagnostic["trend"]): string {
  switch (trend) {
    case "accelerating":
      return "accelerating (sales picking up)";
    case "decelerating":
      return "decelerating (sales slowing)";
    case "stable":
      return "stable";
    default:
      return "unknown";
  }
}

export function buildReorderItemPrompt(
  rec: ReorderRecommendation,
  velocity: VelocityDiagnostic | null
): string {
  const dataGapsText =
    rec.dataGaps.length > 0
      ? rec.dataGaps.join("; ")
      : "none reported";

  const velocitySection = velocity
    ? [
        `Sales trend: ${formatTrendLabel(velocity.trend)}`,
        velocity.velocityTrendPct !== null
          ? `Velocity change vs trailing 12-month average: ${velocity.velocityTrendPct}% over the last 3 months`
          : "Velocity trend percentage: unknown",
        `Average monthly sales (last 3 months): ${formatNullableNumber(velocity.avgMonthlyLast3m, " units")}`,
        `Days of cover at current pace: ${formatNullableNumber(velocity.daysOfCover, " days")}`,
        `Projected stockout date at current pace: ${formatDate(velocity.projectedStockoutDate)}`,
        velocity.mismatchFlags.length > 0
          ? `Mismatch signals: ${velocity.mismatchFlags.map((flag) => flag.message).join(" ")}`
          : "Mismatch signals: none",
        velocity.daysSinceLastSale !== null
          ? `Days since last sale: ${velocity.daysSinceLastSale}`
          : "Days since last sale: unknown",
      ].join("\n")
    : "Sales velocity data is not available for this item.";

  return `You are an inventory analyst writing a brief reorder note for a buyer.

${NO_RECALCULATE_INSTRUCTION}
${NO_EM_DASH_INSTRUCTION}

Write exactly 2-3 short paragraphs separated by a blank line (double newline). Do not use bullet lists or headings.

Paragraph 1: current stock position and demand pattern (1-3 sentences).
Paragraph 2: risk or trend observation, including velocity and stockout timing where relevant (1-3 sentences).
Paragraph 3: clear recommendation or action for the buyer (1-2 sentences).

Weave inventory levels, reorder math, supplier timing, and sales velocity naturally. If data gaps or assumptions were used, mention them briefly in the relevant paragraph, not as a separate list.

Item: ${rec.sku}${rec.name ? ` (${rec.name})` : ""}
Status: ${rec.status}
Supplier: ${rec.supplierName ?? "unknown"}
Lead time (days): ${rec.leadTimeDays ?? "unknown (conservative estimate may apply)"}

Stock position:
- Available: ${rec.quantityAvailable.toLocaleString("en-JM")} units
- On order: ${rec.quantityOnOrder.toLocaleString("en-JM")} units
- In pipeline: ${rec.quantityInPipeline.toLocaleString("en-JM")} units

Reorder calculations (already computed, do not change):
- EOQ: ${formatNullableNumber(rec.eoq, " units")}
- Safety stock: ${formatNullableNumber(rec.safetyStock, " units")}
- Reorder point (ROP): ${formatNullableNumber(rec.rop, " units")}
- Suggested order quantity (rounded): ${rec.suggestedQtyRounded.toLocaleString("en-JM")} units

Data gaps / assumptions: ${dataGapsText}

Sales velocity and trend:
${velocitySection}`;
}

export type PortfolioSummaryPayload = {
  filterDescription: string;
  statusCounts: { critical: number; watch: number; reorder: number; ok: number };
  criticalLineValueTotal: number;
  topCriticalItems: Array<{
    sku: string;
    name: string | null;
    supplierName: string | null;
    suggestedQtyRounded: number;
    lineTotal: number | null;
  }>;
  supplierReorderCounts: Array<{ supplierName: string; count: number }>;
  velocityAggregates: {
    acceleratingStockoutRiskCount: number;
    deceleratingOverstockRiskCount: number;
    deadStockCount: number;
    deadStockTiedUpValue: number;
  };
};

export function buildPortfolioSummaryPrompt(
  payload: PortfolioSummaryPayload
): string {
  const topCriticalLines =
    payload.topCriticalItems.length > 0
      ? payload.topCriticalItems
          .map(
            (item) =>
              `- ${item.sku}${item.name ? ` (${item.name})` : ""}: supplier ${item.supplierName ?? "unknown"}, suggested qty ${item.suggestedQtyRounded.toLocaleString("en-JM")}${item.lineTotal !== null ? `, line value J$${item.lineTotal.toLocaleString("en-JM")}` : ""}`
          )
          .join("\n")
      : "None in the current filter.";

  const supplierLines =
    payload.supplierReorderCounts.length > 0
      ? payload.supplierReorderCounts
          .map(
            (entry) =>
              `- ${entry.supplierName}: ${entry.count} item(s) needing reorder`
          )
          .join("\n")
      : "No supplier concentration in the current filter.";

  return `You are an inventory analyst summarizing a filtered reorder portfolio for a buyer.

${NO_RECALCULATE_INSTRUCTION}
${NO_EM_DASH_INSTRUCTION}

Write exactly 2-3 short paragraphs separated by a blank line (double newline). Do not use bullet lists or headings.

Paragraph 1: overall portfolio position and critical exposure (1-2 sentences).
Paragraph 2: velocity-driven risks, supplier consolidation patterns, and capital tied up (1-2 sentences).
Paragraph 3: recommended focus or actions for the buyer (1-2 sentences).

Use the pre-computed counts and values exactly as given. Do not invent numbers.

Filter context: ${payload.filterDescription}

Status counts:
- Critical: ${payload.statusCounts.critical}
- Watch: ${payload.statusCounts.watch}
- Reorder: ${payload.statusCounts.reorder}
- OK: ${payload.statusCounts.ok}

Total suggested line value for critical items: J$${payload.criticalLineValueTotal.toLocaleString("en-JM")}

Top critical items by line value:
${topCriticalLines}

Suppliers with multiple reorder items:
${supplierLines}

Velocity pattern aggregates (pre-computed):
- Items with accelerating sales AND high-severity stockout mismatch flags: ${payload.velocityAggregates.acceleratingStockoutRiskCount}
- Items with decelerating sales AND excess incoming stock flags: ${payload.velocityAggregates.deceleratingOverstockRiskCount}
- Dead/slow stock candidates (no sales 60+ days with stock on hand): ${payload.velocityAggregates.deadStockCount}
- Capital tied up in dead/slow stock candidates: J$${payload.velocityAggregates.deadStockTiedUpValue.toLocaleString("en-JM")}`;
}

export type PoCoverNotePayload = {
  supplierName: string | null;
  lines: Array<{
    sku: string;
    name: string | null;
    quantity: number;
    unitCost: number | null;
    lineTotal: number | null;
  }>;
  totalValue: number;
  hasUnknownCosts: boolean;
};

function formatCoverNoteUnitCost(unitCost: number | null): string {
  if (unitCost === null) {
    return "cost TBD";
  }

  return `J$${unitCost.toLocaleString("en-JM")} each`;
}

export function buildPoCoverNotePrompt(payload: PoCoverNotePayload): string {
  const lineSummary = payload.lines
    .map(
      (line) =>
        `- ${line.sku}${line.name ? ` (${line.name})` : ""}: ${line.quantity.toLocaleString("en-JM")} units at ${formatCoverNoteUnitCost(line.unitCost)}`
    )
    .join("\n");

  const totalSummary = payload.hasUnknownCosts
    ? "Partial total (some line costs unavailable)"
    : `Order total: J$${payload.totalValue.toLocaleString("en-JM")}`;

  return `You are drafting a professional purchase order cover note for a supplier.

${NO_EM_DASH_INSTRUCTION}

Return ONLY the cover note text itself. Do not include any preamble, introduction, or meta commentary (for example, do not start with "Here is", "Here's", or "Sure,"). Do not wrap the note in quotation marks. Start directly with the first sentence of the cover note.

Write one short paragraph (3-5 sentences) justifying this order. Reference the items and quantities listed. Keep the tone professional and suitable for a PO memo field. Do not recalculate totals.

Supplier: ${payload.supplierName ?? "the supplier"}
${totalSummary}

Line items:
${lineSummary}`;
}

export function buildReorderItemInputHash(
  rec: ReorderRecommendation,
  velocity: VelocityDiagnostic | null
): string {
  return JSON.stringify({
    sku: rec.sku,
    status: rec.status,
    eoq: rec.eoq,
    rop: rec.rop,
    safetyStock: rec.safetyStock,
    suggestedQtyRounded: rec.suggestedQtyRounded,
    quantityAvailable: rec.quantityAvailable,
    quantityOnOrder: rec.quantityOnOrder,
    quantityInPipeline: rec.quantityInPipeline,
    leadTimeDays: rec.leadTimeDays,
    dataGaps: rec.dataGaps,
    trend: velocity?.trend ?? null,
    daysOfCover: velocity?.daysOfCover ?? null,
    velocityTrendPct: velocity?.velocityTrendPct ?? null,
    mismatchTypes: velocity?.mismatchFlags.map((flag) => flag.type) ?? [],
  });
}

export function buildTrendAwareFallbackExplanation(
  rec: ReorderRecommendation,
  velocity: VelocityDiagnostic | null
): string {
  const positionParagraph =
    `This item has ${rec.quantityAvailable.toLocaleString("en-JM")} units available against a reorder point of ${rec.rop !== null ? rec.rop.toLocaleString("en-JM") : "unknown"}, with ${rec.leadTimeDays ?? "unknown"} days of lead time.`;

  let trendParagraph: string | null = null;

  if (velocity) {
    const trendPart =
      velocity.trend === "accelerating" && velocity.velocityTrendPct !== null
        ? `Sales have picked up about ${Math.abs(velocity.velocityTrendPct).toLocaleString("en-JM")}% recently.`
        : velocity.trend === "decelerating" && velocity.velocityTrendPct !== null
          ? `Sales have slowed about ${Math.abs(velocity.velocityTrendPct).toLocaleString("en-JM")}% recently.`
          : velocity.trend === "stable"
            ? "Sales have been relatively stable recently."
            : null;

    const coverPart =
      velocity.daysOfCover !== null
        ? ` At the current pace, stock should last roughly ${velocity.daysOfCover.toLocaleString("en-JM")} days.`
        : "";

    const mismatchPart =
      velocity.mismatchFlags.length > 0
        ? ` ${velocity.mismatchFlags[0]?.message ?? ""}`
        : "";

    trendParagraph = [trendPart, `${coverPart}${mismatchPart}`.trim()]
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  const recommendationParagraph = `Suggested order: ${rec.suggestedQtyRounded.toLocaleString("en-JM")} units to restore coverage based on current reorder calculations.`;

  return [positionParagraph, trendParagraph, recommendationParagraph]
    .filter((paragraph): paragraph is string => Boolean(paragraph?.trim()))
    .join("\n\n");
}

export function buildPortfolioFallbackSummary(
  payload: PortfolioSummaryPayload
): string {
  const { statusCounts, criticalLineValueTotal, velocityAggregates } = payload;
  const actionable = statusCounts.critical + statusCounts.watch + statusCounts.reorder;

  const positionParagraph =
    `${actionable} item(s) in this view need attention (${statusCounts.critical} critical, ${statusCounts.watch} watch, ${statusCounts.reorder} reorder), with critical line value of J$${criticalLineValueTotal.toLocaleString("en-JM")}.`;

  const riskParagraph =
    `${velocityAggregates.acceleratingStockoutRiskCount} fast-moving item(s) show stockout risk before replenishment, while ${velocityAggregates.deceleratingOverstockRiskCount} slowing item(s) have excess incoming stock. ${velocityAggregates.deadStockCount} item(s) have no sales in 60+ days with J$${velocityAggregates.deadStockTiedUpValue.toLocaleString("en-JM")} tied up.`;

  const actionParagraph =
    "Prioritize critical and reorder items with accelerating demand first, and review dead or slow stock before placing new orders. (AI unavailable; showing template summary.)";

  return [positionParagraph, riskParagraph, actionParagraph].join("\n\n");
}

export function buildPoCoverNoteFallback(payload: PoCoverNotePayload): string {
  const itemCount = payload.lines.length;
  const supplierLabel = payload.supplierName ?? "the supplier";
  const totalLabel = payload.hasUnknownCosts
    ? "a partial total because some line costs are unavailable"
    : `a total of J$${payload.totalValue.toLocaleString("en-JM")}`;

  return (
    `Please supply the ${itemCount} line item(s) listed below from ${supplierLabel} ` +
    `for ${totalLabel}. ` +
    `Quantities reflect current reorder recommendations and inventory levels. ` +
    `(AI unavailable; please edit this memo as needed.)`
  );
}
