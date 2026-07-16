import type { AbcClass } from "@/lib/reorder/abc";

/** @deprecated Prefer importing from `@/lib/saved-views/pages`. */
export const REORDER_ACTION_VIEW_PAGE = "reorder_action" as const;

/** Status band values selectable in the multi-select filter. */
export type StatusFilter = "critical" | "watch" | "reorder_needed" | "ok";

export type AbcClassFilter = Exclude<AbcClass, null>;

export type SortKey =
  | "status"
  | "sku"
  | "name"
  | "quantityAvailable"
  | "suggestedQtyRounded"
  | "supplierName"
  | "coverMonths";

export type SortDirection = "asc" | "desc";

export type ReorderActionViewFilters = {
  statusFilter: StatusFilter[];
  abcClassFilter: AbcClassFilter[];
  showNoDemandItems: boolean;
  searchQuery: string;
  supplierFilter: string[];
  sortKey: SortKey;
  sortDirection: SortDirection;
};

export const DEFAULT_REORDER_ACTION_VIEW_FILTERS: ReorderActionViewFilters = {
  statusFilter: ["critical", "watch"],
  abcClassFilter: [],
  showNoDemandItems: false,
  searchQuery: "",
  supplierFilter: [],
  sortKey: "coverMonths",
  sortDirection: "asc",
};

const STATUS_BANDS = new Set<StatusFilter>([
  "critical",
  "watch",
  "reorder_needed",
  "ok",
]);

const ABC_BANDS = new Set<AbcClassFilter>(["A", "B", "C"]);

const SORT_KEYS = new Set<SortKey>([
  "status",
  "sku",
  "name",
  "quantityAvailable",
  "suggestedQtyRounded",
  "supplierName",
  "coverMonths",
]);

const SORT_DIRECTIONS = new Set<SortDirection>(["asc", "desc"]);

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

function parseStatusFilter(raw: unknown): StatusFilter[] | undefined {
  if (Array.isArray(raw)) {
    const values = raw.filter(
      (entry): entry is StatusFilter =>
        typeof entry === "string" && STATUS_BANDS.has(entry as StatusFilter)
    );
    return values;
  }

  if (typeof raw !== "string") {
    return undefined;
  }

  if (raw === "actionable") {
    return ["critical", "watch"];
  }

  if (raw === "all") {
    return [];
  }

  if (STATUS_BANDS.has(raw as StatusFilter)) {
    return [raw as StatusFilter];
  }

  return undefined;
}

function parseAbcClassFilter(raw: unknown): AbcClassFilter[] | undefined {
  if (Array.isArray(raw)) {
    return raw.filter(
      (entry): entry is AbcClassFilter =>
        typeof entry === "string" && ABC_BANDS.has(entry as AbcClassFilter)
    );
  }

  if (typeof raw !== "string") {
    return undefined;
  }

  if (raw === "all") {
    return [];
  }

  if (ABC_BANDS.has(raw as AbcClassFilter)) {
    return [raw as AbcClassFilter];
  }

  return undefined;
}

function parseSupplierFilter(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) {
    return raw
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  if (typeof raw !== "string") {
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed === "all") {
    return [];
  }

  return [trimmed];
}

/**
 * Soft-parse a stored JSON filters blob. Unknown / invalid fields fall back to
 * defaults so older saves keep working as columns evolve. Legacy single-select
 * strings are migrated to one-element arrays (or [] for "all").
 */
export function parseReorderActionViewFilters(
  raw: unknown
): ReorderActionViewFilters {
  const base = {
    ...DEFAULT_REORDER_ACTION_VIEW_FILTERS,
    statusFilter: [...DEFAULT_REORDER_ACTION_VIEW_FILTERS.statusFilter],
    abcClassFilter: [...DEFAULT_REORDER_ACTION_VIEW_FILTERS.abcClassFilter],
    supplierFilter: [...DEFAULT_REORDER_ACTION_VIEW_FILTERS.supplierFilter],
  };
  if (!isRecord(raw)) {
    return base;
  }

  const statusFilter = parseStatusFilter(raw.statusFilter);
  if (statusFilter !== undefined) {
    base.statusFilter = statusFilter;
  }

  const abcClassFilter = parseAbcClassFilter(raw.abcClassFilter);
  if (abcClassFilter !== undefined) {
    base.abcClassFilter = abcClassFilter;
  }

  if (typeof raw.showNoDemandItems === "boolean") {
    base.showNoDemandItems = raw.showNoDemandItems;
  }

  if (typeof raw.searchQuery === "string") {
    base.searchQuery = raw.searchQuery;
  }

  const supplierFilter = parseSupplierFilter(raw.supplierFilter);
  if (supplierFilter !== undefined) {
    base.supplierFilter = supplierFilter;
  }

  if (typeof raw.sortKey === "string" && SORT_KEYS.has(raw.sortKey as SortKey)) {
    base.sortKey = raw.sortKey as SortKey;
  }

  if (
    typeof raw.sortDirection === "string" &&
    SORT_DIRECTIONS.has(raw.sortDirection as SortDirection)
  ) {
    base.sortDirection = raw.sortDirection as SortDirection;
  }

  return base;
}

export function reorderActionViewFiltersEqual(
  left: ReorderActionViewFilters,
  right: ReorderActionViewFilters
): boolean {
  return (
    arraysEqual(left.statusFilter, right.statusFilter) &&
    arraysEqual(left.abcClassFilter, right.abcClassFilter) &&
    left.showNoDemandItems === right.showNoDemandItems &&
    left.searchQuery === right.searchQuery &&
    arraysEqual(left.supplierFilter, right.supplierFilter) &&
    left.sortKey === right.sortKey &&
    left.sortDirection === right.sortDirection
  );
}

export function normalizeViewName(name: string): string | null {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0 || trimmed.length > 80) {
    return null;
  }
  return trimmed;
}
