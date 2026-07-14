import { describe, expect, it } from "vitest";
import {
  DEFAULT_REORDER_ACTION_VIEW_FILTERS,
  normalizeViewName,
  parseReorderActionViewFilters,
  reorderActionViewFiltersEqual,
} from "@/lib/reorder/view-filters";

describe("parseReorderActionViewFilters", () => {
  it("returns defaults for empty input", () => {
    expect(parseReorderActionViewFilters(null)).toEqual(
      DEFAULT_REORDER_ACTION_VIEW_FILTERS
    );
  });

  it("keeps valid fields and soft-falls back invalid ones", () => {
    const parsed = parseReorderActionViewFilters({
      statusFilter: "critical",
      abcClassFilter: "A",
      showNoDemandItems: true,
      searchQuery: "hankook",
      supplierFilter: "FK020",
      sortKey: "sku",
      sortDirection: "desc",
      unknown: true,
    });

    expect(parsed).toEqual({
      statusFilter: "critical",
      abcClassFilter: "A",
      showNoDemandItems: true,
      searchQuery: "hankook",
      supplierFilter: "FK020",
      sortKey: "sku",
      sortDirection: "desc",
    });

    const soft = parseReorderActionViewFilters({
      statusFilter: "not-a-status",
      sortKey: 12,
      supplierFilter: "  ",
    });
    expect(soft.statusFilter).toBe(
      DEFAULT_REORDER_ACTION_VIEW_FILTERS.statusFilter
    );
    expect(soft.sortKey).toBe(DEFAULT_REORDER_ACTION_VIEW_FILTERS.sortKey);
    expect(soft.supplierFilter).toBe(
      DEFAULT_REORDER_ACTION_VIEW_FILTERS.supplierFilter
    );
  });
});

describe("reorderActionViewFiltersEqual", () => {
  it("compares snapshots field-by-field", () => {
    expect(
      reorderActionViewFiltersEqual(
        DEFAULT_REORDER_ACTION_VIEW_FILTERS,
        { ...DEFAULT_REORDER_ACTION_VIEW_FILTERS }
      )
    ).toBe(true);
    expect(
      reorderActionViewFiltersEqual(DEFAULT_REORDER_ACTION_VIEW_FILTERS, {
        ...DEFAULT_REORDER_ACTION_VIEW_FILTERS,
        statusFilter: "critical",
      })
    ).toBe(false);
  });
});

describe("normalizeViewName", () => {
  it("trims and rejects empty or oversized names", () => {
    expect(normalizeViewName("  Hankook Critical  ")).toBe("Hankook Critical");
    expect(normalizeViewName("   ")).toBeNull();
    expect(normalizeViewName("a".repeat(81))).toBeNull();
  });
});
