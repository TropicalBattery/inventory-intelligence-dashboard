import { describe, expect, it } from "vitest";
import {
  computeCurrentMonthsOfCover,
  computeMonthsOfCoverAtOrderQty,
  formatMonthsOfCoverLabel,
  getMonthsOfCoverColorTier,
  resolveAvgMonthlyDemand,
} from "@/lib/reorder/months-of-cover";

const baseRec = {
  quantityOnHand: 100,
  quantityAllocated: 20,
  quantityInPipeline: 30,
  annualDemandUnits: 1200,
  avgDailyDemandUnits: null,
};

describe("resolveAvgMonthlyDemand", () => {
  it("prefers annual demand divided by twelve", () => {
    expect(
      resolveAvgMonthlyDemand({
        annualDemandUnits: 1200,
        avgDailyDemandUnits: 5,
      })
    ).toBe(100);
  });

  it("falls back to daily demand scaled to a month", () => {
    expect(
      resolveAvgMonthlyDemand({
        annualDemandUnits: null,
        avgDailyDemandUnits: 10,
      })
    ).toBeCloseTo(304.4, 1);
  });
});

describe("computeMonthsOfCoverAtOrderQty", () => {
  it("uses on hand minus allocated plus pipeline plus order qty", () => {
    const months = computeMonthsOfCoverAtOrderQty(baseRec, 50);
    expect(months).toBeCloseTo(1.6, 2);
  });
});

describe("formatMonthsOfCoverLabel", () => {
  it("formats values as months with one decimal place", () => {
    expect(formatMonthsOfCoverLabel(2.44)).toBe("2.4 months");
    expect(formatMonthsOfCoverLabel(null)).toBe("Unknown");
  });
});

describe("computeCurrentMonthsOfCover", () => {
  it("uses current stock position without an order quantity", () => {
    expect(computeCurrentMonthsOfCover(baseRec)).toBeCloseTo(1.1, 2);
  });
});

describe("getMonthsOfCoverColorTier", () => {
  it("maps thresholds to red, amber, and green", () => {
    expect(getMonthsOfCoverColorTier(1.5)).toBe("red");
    expect(getMonthsOfCoverColorTier(2)).toBe("amber");
    expect(getMonthsOfCoverColorTier(3.9)).toBe("amber");
    expect(getMonthsOfCoverColorTier(4)).toBe("green");
    expect(getMonthsOfCoverColorTier(null)).toBe("unknown");
  });
});
