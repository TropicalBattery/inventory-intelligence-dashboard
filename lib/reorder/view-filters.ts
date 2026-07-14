import type { AbcClass } from "@/lib/reorder/abc";

/** Saved-view page key for Reorder Action (FEAT-08). */
export const REORDER_ACTION_VIEW_PAGE = "reorder_action" as const;

export type StatusFilter =
  | "actionable"
  | "all"
  | "critical"
  | "watch"
  | "reorder_needed"
  | "ok";

export type AbcClassFilter = "all" | Exclude<AbcClass, null>;

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
  statusFilter: StatusFilter;
  abcClassFilter: AbcClassFilter;
  showNoDemandItems: boolean;
  searchQuery: string;
  supplierFilter: string;
  sortKey: SortKey;
  sortDirection: SortDirection;
};

export const DEFAULT_REORDER_ACTION_VIEW_FILTERS: ReorderActionViewFilters = {
  statusFilter: "actionable",
  abcClassFilter: "all",
  showNoDemandItems: false,
  searchQuery: "",
  supplierFilter: "all",
  sortKey: "coverMonths",
  sortDirection: "asc",
};

const STATUS_FILTERS = new Set<StatusFilter>([
  "actionable",
  "all",
  "critical",
  "watch",
  "reorder_needed",
  "ok",
]);

const ABC_FILTERS = new Set<AbcClassFilter>(["all", "A", "B", "C"]);

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

/**
 * Soft-parse a stored JSON filters blob. Unknown / invalid fields fall back to
 * defaults so older saves keep working as columns evolve.
 */
export function parseReorderActionViewFilters(
  raw: unknown
): ReorderActionViewFilters {
  const base = { ...DEFAULT_REORDER_ACTION_VIEW_FILTERS };
  if (!isRecord(raw)) {
    return base;
  }

  if (
    typeof raw.statusFilter === "string" &&
    STATUS_FILTERS.has(raw.statusFilter as StatusFilter)
  ) {
    base.statusFilter = raw.statusFilter as StatusFilter;
  }

  if (
    typeof raw.abcClassFilter === "string" &&
    ABC_FILTERS.has(raw.abcClassFilter as AbcClassFilter)
  ) {
    base.abcClassFilter = raw.abcClassFilter as AbcClassFilter;
  }

  if (typeof raw.showNoDemandItems === "boolean") {
    base.showNoDemandItems = raw.showNoDemandItems;
  }

  if (typeof raw.searchQuery === "string") {
    base.searchQuery = raw.searchQuery;
  }

  if (typeof raw.supplierFilter === "string" && raw.supplierFilter.trim()) {
    base.supplierFilter = raw.supplierFilter.trim();
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
    left.statusFilter === right.statusFilter &&
    left.abcClassFilter === right.abcClassFilter &&
    left.showNoDemandItems === right.showNoDemandItems &&
    left.searchQuery === right.searchQuery &&
    left.supplierFilter === right.supplierFilter &&
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
