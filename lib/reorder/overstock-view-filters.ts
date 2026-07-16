import type { AbcClass } from "@/lib/reorder/abc";

export type OverstockSortKey =
  | "excessValue"
  | "monthsOfCover"
  | "excessUnits"
  | "sku";

export type OverstockSortDirection = "asc" | "desc";

export type OverstockViewFilters = {
  abcClassFilter: Array<Exclude<AbcClass, null>>;
  supplierFilter: string[];
  peakApproachingOnly: boolean;
  searchQuery: string;
  sortKey: OverstockSortKey;
  sortDirection: OverstockSortDirection;
};

export const DEFAULT_OVERSTOCK_VIEW_FILTERS: OverstockViewFilters = {
  abcClassFilter: [],
  supplierFilter: [],
  peakApproachingOnly: false,
  searchQuery: "",
  sortKey: "excessValue",
  sortDirection: "desc",
};

const ABC_BANDS = new Set<Exclude<AbcClass, null>>(["A", "B", "C"]);
const SORT_KEYS = new Set<OverstockSortKey>([
  "excessValue",
  "monthsOfCover",
  "excessUnits",
  "sku",
]);
const SORT_DIRECTIONS = new Set<OverstockSortDirection>(["asc", "desc"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

export function parseOverstockViewFilters(raw: unknown): OverstockViewFilters {
  const base: OverstockViewFilters = {
    ...DEFAULT_OVERSTOCK_VIEW_FILTERS,
    abcClassFilter: [...DEFAULT_OVERSTOCK_VIEW_FILTERS.abcClassFilter],
    supplierFilter: [...DEFAULT_OVERSTOCK_VIEW_FILTERS.supplierFilter],
  };

  if (!isRecord(raw)) {
    return base;
  }

  if (Array.isArray(raw.abcClassFilter)) {
    base.abcClassFilter = raw.abcClassFilter.filter(
      (entry): entry is Exclude<AbcClass, null> =>
        typeof entry === "string" &&
        ABC_BANDS.has(entry as Exclude<AbcClass, null>)
    );
  } else if (typeof raw.abcClassFilter === "string") {
    if (raw.abcClassFilter === "all") {
      base.abcClassFilter = [];
    } else if (ABC_BANDS.has(raw.abcClassFilter as Exclude<AbcClass, null>)) {
      base.abcClassFilter = [raw.abcClassFilter as Exclude<AbcClass, null>];
    }
  }

  if (Array.isArray(raw.supplierFilter)) {
    base.supplierFilter = raw.supplierFilter
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && entry !== "all");
  } else if (typeof raw.supplierFilter === "string") {
    const trimmed = raw.supplierFilter.trim();
    base.supplierFilter = !trimmed || trimmed === "all" ? [] : [trimmed];
  }

  if (typeof raw.peakApproachingOnly === "boolean") {
    base.peakApproachingOnly = raw.peakApproachingOnly;
  }

  if (typeof raw.searchQuery === "string") {
    base.searchQuery = raw.searchQuery;
  }

  if (
    typeof raw.sortKey === "string" &&
    SORT_KEYS.has(raw.sortKey as OverstockSortKey)
  ) {
    base.sortKey = raw.sortKey as OverstockSortKey;
  }

  if (
    typeof raw.sortDirection === "string" &&
    SORT_DIRECTIONS.has(raw.sortDirection as OverstockSortDirection)
  ) {
    base.sortDirection = raw.sortDirection as OverstockSortDirection;
  }

  return base;
}

export function overstockViewFiltersEqual(
  left: OverstockViewFilters,
  right: OverstockViewFilters
): boolean {
  return (
    arraysEqual(left.abcClassFilter, right.abcClassFilter) &&
    arraysEqual(left.supplierFilter, right.supplierFilter) &&
    left.peakApproachingOnly === right.peakApproachingOnly &&
    left.searchQuery === right.searchQuery &&
    left.sortKey === right.sortKey &&
    left.sortDirection === right.sortDirection
  );
}
