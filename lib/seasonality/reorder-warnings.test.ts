import { describe, expect, it } from "vitest";
import { getSeasonalReorderWarning } from "@/lib/seasonality/reorder-warnings";
import type { ItemSeasonalityProfile } from "@/lib/seasonality/types";

describe("getSeasonalReorderWarning", () => {
  it("returns peak now when the current month is a peak month", () => {
    const warning = getSeasonalReorderWarning(
      {
        sku: "SKU-A",
        seasonality_strength: "high",
        peak_months: [6],
        seasonality_profile: null,
      },
      new Date(2026, 5, 15)
    );

    expect(warning?.kind).toBe("peak_now");
  });

  it("returns approaching warning when a peak month is within 93 days", () => {
    const warning = getSeasonalReorderWarning(
      {
        sku: "SKU-A",
        seasonality_strength: "high",
        peak_months: [8],
        seasonality_profile: null,
      },
      new Date(2026, 5, 1)
    );

    expect(warning?.kind).toBe("peak_approaching");
    expect(warning?.message).toContain("Aug");
  });
});
