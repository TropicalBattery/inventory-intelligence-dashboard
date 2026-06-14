import { describe, expect, it } from "vitest";
import {
  computeLineTotal,
  normalizeStoredLineCost,
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
});
