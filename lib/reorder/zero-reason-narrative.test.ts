import { describe, expect, it } from "vitest";
import { getZeroReasonNarrative } from "@/lib/reorder/zero-reason-narrative";

describe("getZeroReasonNarrative", () => {
  it("returns null when no zero reason", () => {
    expect(
      getZeroReasonNarrative({
        suggestedQtyZeroReason: null,
        annualDemandUnits: 7,
        quantityOnOrder: 100,
        purchaseRule: null,
      })
    ).toBeNull();
  });

  it("caps absurd supply duration instead of printing thousands of years", () => {
    const text = getZeroReasonNarrative({
      suggestedQtyZeroReason: "already_covered",
      annualDemandUnits: 7,
      quantityOnOrder: 21600,
      purchaseRule: null,
    });
    expect(text).toContain("far more than you'll sell in years");
    expect(text).not.toMatch(/\d{3,}\s+years/);
  });

  it("phrases sub-year supply in months", () => {
    // 8/12 year ≈ 0.667 → about 8 months
    const text = getZeroReasonNarrative({
      suggestedQtyZeroReason: "already_covered",
      annualDemandUnits: 12,
      quantityOnOrder: 8,
      purchaseRule: null,
    });
    expect(text).toContain("about 8 months of supply");
  });

  it("maps discontinue blocked_rule to readable flag text", () => {
    const text = getZeroReasonNarrative({
      suggestedQtyZeroReason: "blocked_rule",
      annualDemandUnits: null,
      quantityOnOrder: 0,
      purchaseRule: { ruleType: "discontinue", lockedVendorId: null },
    });
    expect(text).toContain("do not reorder (discontinued)");
  });
});
