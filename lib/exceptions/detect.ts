import type { ItemPurchaseRule, ReorderRecommendation } from "@/lib/types";

export type ExceptionType =
  | "negative_stock"
  | "missing_supplier_data"
  | "stale_demand"
  | "conflicting_rules";

export type ExceptionSeverity = "high" | "medium" | "low";

export const EXCEPTION_SEVERITY: Record<ExceptionType, ExceptionSeverity> = {
  negative_stock: "high",
  missing_supplier_data: "medium",
  stale_demand: "low",
  conflicting_rules: "low",
};

export const EXCEPTION_SEVERITY_ORDER: Record<ExceptionSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const EXCEPTION_LABELS: Record<ExceptionType, string> = {
  negative_stock: "Negative stock",
  missing_supplier_data: "Missing supplier data",
  stale_demand: "Stale demand",
  conflicting_rules: "Conflicting rules",
};

export const STALE_DEMAND_DAYS = 90;

export type NegativeStockRow = {
  sku: string;
  locationCode: string | null;
  quantityOnHand: number;
  quantityAvailable: number;
};

export type StaleDemandRow = {
  sku: string;
  quantityOnHand: number;
  lastSalesDate: string;
};

export type SkuException = {
  type: ExceptionType;
  severity: ExceptionSeverity;
  detail: string;
};

export type SkuExceptionGroup = {
  sku: string;
  name: string | null;
  exceptions: SkuException[];
  /** Worst severity among this SKU's exceptions. */
  severity: ExceptionSeverity;
};

export type ExceptionSummary = {
  totalSkus: number;
  negativeStock: number;
  missingSupplierData: number;
  staleDemand: number;
  conflictingRules: number;
};

export type DetectExceptionsInput = {
  recommendations: ReorderRecommendation[];
  negativeStockRows: NegativeStockRow[];
  staleDemandRows: StaleDemandRow[];
  /** Optional clock for tests. */
  now?: Date;
};

function severityRank(severity: ExceptionSeverity): number {
  return EXCEPTION_SEVERITY_ORDER[severity];
}

function worseSeverity(
  left: ExceptionSeverity,
  right: ExceptionSeverity
): ExceptionSeverity {
  return severityRank(left) <= severityRank(right) ? left : right;
}

export function daysSince(
  isoDate: string,
  now: Date = new Date()
): number | null {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const ms = now.getTime() - parsed.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/** Whitelisted + demand + no usable supplier lead/ref (dataGaps / null lead). */
export function hasMissingSupplierData(
  rec: Pick<
    ReorderRecommendation,
    | "isWhitelisted"
    | "annualDemandUnits"
    | "leadTimeDays"
    | "supplierExternalId"
    | "dataGaps"
  >
): boolean {
  if (!rec.isWhitelisted) {
    return false;
  }
  if (!((rec.annualDemandUnits ?? 0) > 0)) {
    return false;
  }

  const gapSaysMissing = rec.dataGaps.some(
    (gap) =>
      gap.includes("No lead_time_days") ||
      gap.includes("missing cost and lead time")
  );

  if (gapSaysMissing) {
    return true;
  }

  // No supplier reference on the recommendation (no item_supplier_reference pick).
  return rec.supplierExternalId === null && rec.leadTimeDays === null;
}

export function hasConflictingRules(
  rec: Pick<ReorderRecommendation, "isWhitelisted" | "purchaseRule">
): boolean {
  if (!rec.isWhitelisted) {
    return false;
  }
  const ruleType = rec.purchaseRule?.ruleType;
  return ruleType === "discontinue" || ruleType === "do_not_buy";
}

export function isStaleDemand(
  row: StaleDemandRow,
  now: Date = new Date(),
  thresholdDays: number = STALE_DEMAND_DAYS
): boolean {
  if (!(row.quantityOnHand > 0)) {
    return false;
  }
  const age = daysSince(row.lastSalesDate, now);
  if (age === null) {
    return false;
  }
  return age > thresholdDays;
}

function conflictingRuleLabel(
  rule: ItemPurchaseRule | null | undefined
): string {
  if (rule?.ruleType === "discontinue") {
    return "discontinued";
  }
  if (rule?.ruleType === "do_not_buy") {
    return "do not buy";
  }
  return "blocked";
}

function negativeStockDetail(row: NegativeStockRow): string {
  const location = row.locationCode?.trim() || "unknown location";
  const qty =
    row.quantityOnHand < 0
      ? row.quantityOnHand
      : row.quantityAvailable < 0
        ? row.quantityAvailable
        : Math.min(row.quantityOnHand, row.quantityAvailable);
  return `On hand: ${qty.toLocaleString("en-US")} at ${location}`;
}

function staleDemandDetail(row: StaleDemandRow, now: Date): string {
  const age = daysSince(row.lastSalesDate, now) ?? 0;
  return `Last sale ${age.toLocaleString("en-US")} days ago, ${row.quantityOnHand.toLocaleString("en-US")} units held`;
}

/**
 * Pure detection: merge recommendation-derived exceptions with negative-stock
 * / stale-demand rows. Negative stock is catalogue-wide; others whitelist-scoped.
 */
export function detectExceptions(
  input: DetectExceptionsInput
): SkuExceptionGroup[] {
  const now = input.now ?? new Date();
  const bySku = new Map<string, SkuExceptionGroup>();

  function ensureGroup(
    sku: string,
    name: string | null
  ): SkuExceptionGroup {
    const existing = bySku.get(sku);
    if (existing) {
      if (!existing.name && name) {
        existing.name = name;
      }
      return existing;
    }
    const created: SkuExceptionGroup = {
      sku,
      name,
      exceptions: [],
      severity: "low",
    };
    bySku.set(sku, created);
    return created;
  }

  function addException(
    sku: string,
    name: string | null,
    exception: SkuException
  ) {
    const group = ensureGroup(sku, name);
    if (group.exceptions.some((e) => e.type === exception.type)) {
      return;
    }
    group.exceptions.push(exception);
    group.severity = worseSeverity(group.severity, exception.severity);
  }

  for (const row of input.negativeStockRows) {
    if (!row.sku) {
      continue;
    }
    if (!(row.quantityOnHand < 0 || row.quantityAvailable < 0)) {
      continue;
    }
    addException(row.sku, null, {
      type: "negative_stock",
      severity: EXCEPTION_SEVERITY.negative_stock,
      detail: negativeStockDetail(row),
    });
  }

  const nameBySku = new Map<string, string | null>();
  for (const rec of input.recommendations) {
    nameBySku.set(rec.sku, rec.name);
  }

  for (const rec of input.recommendations) {
    if (hasMissingSupplierData(rec)) {
      addException(rec.sku, rec.name, {
        type: "missing_supplier_data",
        severity: EXCEPTION_SEVERITY.missing_supplier_data,
        detail: "No supplier reference - ROP/EOQ not calculated",
      });
    }

    if (hasConflictingRules(rec)) {
      addException(rec.sku, rec.name, {
        type: "conflicting_rules",
        severity: EXCEPTION_SEVERITY.conflicting_rules,
        detail: `In Item Master but marked ${conflictingRuleLabel(rec.purchaseRule)}`,
      });
    }
  }

  const whitelistedSkus = new Set(
    input.recommendations
      .filter((rec) => rec.isWhitelisted)
      .map((rec) => rec.sku)
  );

  for (const row of input.staleDemandRows) {
    if (!whitelistedSkus.has(row.sku)) {
      continue;
    }
    if (!isStaleDemand(row, now)) {
      continue;
    }
    addException(row.sku, nameBySku.get(row.sku) ?? null, {
      type: "stale_demand",
      severity: EXCEPTION_SEVERITY.stale_demand,
      detail: staleDemandDetail(row, now),
    });
  }

  const groups = Array.from(bySku.values());
  groups.sort((left, right) => {
    const severityDiff =
      severityRank(left.severity) - severityRank(right.severity);
    if (severityDiff !== 0) {
      return severityDiff;
    }
    return left.sku.localeCompare(right.sku);
  });

  for (const group of groups) {
    group.exceptions.sort(
      (a, b) => severityRank(a.severity) - severityRank(b.severity)
    );
  }

  return groups;
}

export function summarizeExceptions(
  groups: SkuExceptionGroup[]
): ExceptionSummary {
  let negativeStock = 0;
  let missingSupplierData = 0;
  let staleDemand = 0;
  let conflictingRules = 0;

  for (const group of groups) {
    for (const exception of group.exceptions) {
      switch (exception.type) {
        case "negative_stock":
          negativeStock += 1;
          break;
        case "missing_supplier_data":
          missingSupplierData += 1;
          break;
        case "stale_demand":
          staleDemand += 1;
          break;
        case "conflicting_rules":
          conflictingRules += 1;
          break;
      }
    }
  }

  return {
    totalSkus: groups.length,
    negativeStock,
    missingSupplierData,
    staleDemand,
    conflictingRules,
  };
}
