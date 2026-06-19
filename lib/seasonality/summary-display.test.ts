import { describe, expect, it } from "vitest";
import { buildDemandDrivers } from "@/lib/seasonality/summary-display";
import type { SeasonalCategoryInsight } from "@/lib/seasonality/types";

function category(
  overrides: Partial<SeasonalCategoryInsight> & Pick<SeasonalCategoryInsight, "item_class">
): SeasonalCategoryInsight {
  return {
    peak_months: [7],
    reason: "Summer demand",
    build_stock_by_month: "Apr",
    strength: "high",
    ...overrides,
  };
}

describe("buildDemandDrivers", () => {
  it("maps categories to fixed drivers", () => {
    const drivers = buildDemandDrivers([
      category({ item_class: "BAT-MAC", peak_months: [7] }),
      category({ item_class: "BATT-SOLAR", peak_months: [9] }),
      category({ item_class: "BAT-AUTO", peak_months: [8] }),
    ]);

    expect(drivers.find((driver) => driver.id === "summer")?.categories).toHaveLength(
      1
    );
    expect(
      drivers.find((driver) => driver.id === "post_storm")?.categories
    ).toHaveLength(1);
    expect(
      drivers.find((driver) => driver.id === "hurricane")?.categories
    ).toHaveLength(3);
  });
});
