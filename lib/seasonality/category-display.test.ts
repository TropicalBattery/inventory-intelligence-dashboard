import { describe, expect, it } from "vitest";
import {
  getOrderWindowMonth,
  getOrderWindowMonths,
  sortSeasonalCategories,
} from "@/lib/seasonality/category-display";
import type { SeasonalCategoryInsight } from "@/lib/seasonality/types";

function category(
  overrides: Partial<SeasonalCategoryInsight> & Pick<SeasonalCategoryInsight, "item_class">
): SeasonalCategoryInsight {
  return {
    peak_months: [7],
    reason: "Summer demand",
    build_stock_by_month: "Apr",
    strength: "moderate",
    ...overrides,
  };
}

describe("getOrderWindowMonth", () => {
  it("subtracts three months with year wrap", () => {
    expect(getOrderWindowMonth(7)).toBe(4);
    expect(getOrderWindowMonth(12)).toBe(9);
    expect(getOrderWindowMonth(1)).toBe(10);
  });
});

describe("sortSeasonalCategories", () => {
  it("sorts by urgency, strength, then name", () => {
    const referenceDate = new Date(2026, 3, 15);
    const sorted = sortSeasonalCategories(
      [
        category({ item_class: "Bravo", strength: "moderate", peak_months: [8] }),
        category({ item_class: "Alpha", strength: "high", peak_months: [8] }),
        category({ item_class: "Charlie", strength: "high", peak_months: [4] }),
        category({ item_class: "Delta", strength: "high", peak_months: [4] }),
      ],
      referenceDate
    );

    expect(sorted.map((entry) => entry.item_class)).toEqual([
      "Charlie",
      "Delta",
      "Alpha",
      "Bravo",
    ]);
  });
});

describe("getOrderWindowMonths", () => {
  it("deduplicates overlapping order windows", () => {
    expect(getOrderWindowMonths([4, 5])).toEqual([1, 2]);
  });
});
