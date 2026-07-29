import { describe, expect, it } from "vitest";
import {
  formatZeroReasonExclusionSummary,
  getZeroReasonText,
} from "@/lib/reorder/zero-reason-text";
import type { ReorderRecommendation } from "@/lib/types";

function pick(
  overrides: Partial<
    Pick<
      ReorderRecommendation,
      | "suggestedQtyZeroReason"
      | "annualDemandUnits"
      | "quantityOnOrder"
      | "purchaseRule"
    >
  >
) {
  return {
    suggestedQtyZeroReason: null as ReorderRecommendation["suggestedQtyZeroReason"],
    annualDemandUnits: null as number | null,
    quantityOnOrder: 0,
    purchaseRule: null as ReorderRecommendation["purchaseRule"],
    ...overrides,
  };
}

describe("getZeroReasonText", () => {
  it("returns null when no zero reason", () => {
    expect(getZeroReasonText(pick({ suggestedQtyZeroReason: null }))).toBeNull();
  });

  it("templates already_covered with on-order years of supply", () => {
    const text = getZeroReasonText(
      pick({
        suggestedQtyZeroReason: "already_covered",
        annualDemandUnits: 7,
        quantityOnOrder: 288,
      })
    );
    expect(text?.short).toBe("Already covered");
    expect(text?.detail).toContain("7/yr sold");
    expect(text?.detail).toContain("288 already on order");
    expect(text?.detail).toContain("yrs of supply");
  });

  it("uses stock-covers phrasing when nothing is on order", () => {
    const text = getZeroReasonText(
      pick({
        suggestedQtyZeroReason: "already_covered",
        quantityOnOrder: 0,
      })
    );
    expect(text?.detail).toBe(
      "Current stock already covers the reorder point, so no reorder is needed."
    );
  });

  it("maps blocked_rule discontinue to readable wording", () => {
    const text = getZeroReasonText(
      pick({
        suggestedQtyZeroReason: "blocked_rule",
        purchaseRule: { ruleType: "discontinue", lockedVendorId: null },
      })
    );
    expect(text?.short).toBe("Ordering off");
    expect(text?.detail).toContain("do not reorder (discontinued)");
  });
});

describe("formatZeroReasonExclusionSummary", () => {
  it("states a single reason type without a count list", () => {
    expect(
      formatZeroReasonExclusionSummary([
        { suggestedQtyZeroReason: "already_covered" },
        { suggestedQtyZeroReason: "already_covered" },
      ])
    ).toBe("2 items excluded: already covered");
  });

  it("tallies mixed reasons", () => {
    expect(
      formatZeroReasonExclusionSummary([
        { suggestedQtyZeroReason: "already_covered" },
        { suggestedQtyZeroReason: "already_covered" },
        { suggestedQtyZeroReason: "blocked_rule" },
      ])
    ).toBe("3 items excluded: 2 already covered, 1 ordering off.");
  });
});
