import type { ReorderStatus } from "@/lib/types";

export type InventoryStatusFilter = Exclude<ReorderStatus, never>;

export type InventoryViewFilters = {
  statusFilter: InventoryStatusFilter[];
  classFilter: string[];
  searchQuery: string;
  showInactive: boolean;
};

export const DEFAULT_INVENTORY_VIEW_FILTERS: InventoryViewFilters = {
  statusFilter: [],
  classFilter: [],
  searchQuery: "",
  showInactive: false,
};

const STATUS_BANDS = new Set<InventoryStatusFilter>([
  "critical",
  "watch",
  "reorder_needed",
  "ok",
  "no_demand",
]);

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

function parseStatusValue(raw: string): InventoryStatusFilter | null {
  if (raw === "all") {
    return null;
  }
  if (raw === "reorder") {
    return "reorder_needed";
  }
  if (raw === "inactive") {
    return "no_demand";
  }
  if (STATUS_BANDS.has(raw as InventoryStatusFilter)) {
    return raw as InventoryStatusFilter;
  }
  return null;
}

export function parseInventoryViewFilters(raw: unknown): InventoryViewFilters {
  const base: InventoryViewFilters = {
    ...DEFAULT_INVENTORY_VIEW_FILTERS,
    statusFilter: [...DEFAULT_INVENTORY_VIEW_FILTERS.statusFilter],
    classFilter: [...DEFAULT_INVENTORY_VIEW_FILTERS.classFilter],
  };

  if (!isRecord(raw)) {
    return base;
  }

  if (Array.isArray(raw.statusFilter)) {
    const values: InventoryStatusFilter[] = [];
    for (const entry of raw.statusFilter) {
      if (typeof entry !== "string") {
        continue;
      }
      const parsed = parseStatusValue(entry);
      if (parsed) {
        values.push(parsed);
      }
    }
    base.statusFilter = values;
  } else if (typeof raw.statusFilter === "string") {
    const parsed = parseStatusValue(raw.statusFilter);
    base.statusFilter = parsed ? [parsed] : [];
  }

  if (Array.isArray(raw.classFilter)) {
    base.classFilter = raw.classFilter
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && entry !== "all");
  } else if (typeof raw.classFilter === "string") {
    const trimmed = raw.classFilter.trim();
    base.classFilter = !trimmed || trimmed === "all" ? [] : [trimmed];
  }

  if (typeof raw.searchQuery === "string") {
    base.searchQuery = raw.searchQuery;
  }

  if (typeof raw.showInactive === "boolean") {
    base.showInactive = raw.showInactive;
  }

  return base;
}

export function inventoryViewFiltersEqual(
  left: InventoryViewFilters,
  right: InventoryViewFilters
): boolean {
  return (
    arraysEqual(left.statusFilter, right.statusFilter) &&
    arraysEqual(left.classFilter, right.classFilter) &&
    left.searchQuery === right.searchQuery &&
    left.showInactive === right.showInactive
  );
}
