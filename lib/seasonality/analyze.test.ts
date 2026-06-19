import { describe, expect, it } from "vitest";
import {
  buildSkuSeasonalityProfiles,
  classifySeasonalityStrength,
  pickTopSeasonalSkus,
} from "@/lib/seasonality/analyze";
import type { MonthlyDemandRow } from "@/lib/seasonality/types";

const rows: MonthlyDemandRow[] = [
  {
    item_number: "SKU-A",
    item_description: "Battery A",
    item_class: "BAT",
    month_num: 1,
    month_name: "Jan",
    avg_monthly_qty: 50,
    seasonality_index: 0.8,
  },
  {
    item_number: "SKU-A",
    item_description: "Battery A",
    item_class: "BAT",
    month_num: 7,
    month_name: "Jul",
    avg_monthly_qty: 150,
    seasonality_index: 1.5,
  },
  {
    item_number: "SKU-B",
    item_description: "Battery B",
    item_class: "BAT",
    month_num: 3,
    month_name: "Mar",
    avg_monthly_qty: 40,
    seasonality_index: 1.0,
  },
  {
    item_number: "SKU-B",
    item_description: "Battery B",
    item_class: "BAT",
    month_num: 12,
    month_name: "Dec",
    avg_monthly_qty: 60,
    seasonality_index: 1.25,
  },
];

describe("classifySeasonalityStrength", () => {
  it("maps index thresholds to high, moderate, and flat", () => {
    expect(classifySeasonalityStrength(1.5)).toBe("high");
    expect(classifySeasonalityStrength(1.25)).toBe("moderate");
    expect(classifySeasonalityStrength(1.1)).toBe("flat");
  });
});

describe("buildSkuSeasonalityProfiles", () => {
  it("flags peak months and strength per SKU", () => {
    const profiles = buildSkuSeasonalityProfiles(rows);
    const skuA = profiles.find((profile) => profile.sku === "SKU-A");

    expect(skuA?.seasonality_strength).toBe("high");
    expect(skuA?.peak_months).toEqual([7]);
  });
});

describe("pickTopSeasonalSkus", () => {
  it("prioritizes high strength SKUs first", () => {
    const profiles = buildSkuSeasonalityProfiles(rows);
    const top = pickTopSeasonalSkus(profiles, 10);

    expect(top[0]?.sku).toBe("SKU-A");
    expect(top.some((profile) => profile.sku === "SKU-B")).toBe(true);
  });
});
