import { describe, expect, it } from "vitest";
import {
  computeLineTotal,
  countUnknownLineCosts,
  normalizeStoredLineCost,
  resolvePoDisplayTotal,
  resolveUnitCostFromSources,
} from "@/lib/po/line-cost";

describe("line-cost helpers", () => {
  it("returns null when no cost sources exist", () => {
    expect(resolveUnitCostFromSources(null, null)).toBeNull();
  });

  it("treats legacy zero-cost rows as unknown when quantity is positive", () => {
    expect(normalizeStoredLineCost(0, 12, 0)).toEqual({
      unitCost: null,
      lineTotal: null,
    });
  });

  it("computes line totals only when unit cost is known", () => {
    expect(computeLineTotal(5, null)).toBeNull();
    expect(computeLineTotal(5, 10)).toBe(50);
  });

  it("counts unknown line costs", () => {
    expect(
      countUnknownLineCosts([
        { unitCost: 10 },
        { unitCost: null },
        { unitCost: null },
      ])
    ).toBe(2);
  });

  it("resolves display total to null when any line is unpriced", () => {
    expect(
      resolvePoDisplayTotal([
        { unitCost: 10, lineTotal: 50 },
        { unitCost: null, lineTotal: null },
      ])
    ).toBeNull();
  });

  it("resolves display total when all lines are priced", () => {
    expect(
      resolvePoDisplayTotal([
        { unitCost: 10, lineTotal: 50 },
        { unitCost: 2, lineTotal: 6 },
      ])
    ).toBe(56);
  });
});
