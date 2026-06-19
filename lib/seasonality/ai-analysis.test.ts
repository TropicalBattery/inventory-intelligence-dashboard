import { describe, expect, it } from "vitest";
import { TRUNCATED_SEASONAL_ANALYSIS_FALLBACK } from "@/lib/seasonality/ai-analysis";

describe("TRUNCATED_SEASONAL_ANALYSIS_FALLBACK", () => {
  it("provides a graceful summary when JSON parsing fails", () => {
    expect(TRUNCATED_SEASONAL_ANALYSIS_FALLBACK.summary).toContain(
      "Seasonal pattern data was collected"
    );
    expect(TRUNCATED_SEASONAL_ANALYSIS_FALLBACK.seasonal_categories).toEqual([]);
    expect(TRUNCATED_SEASONAL_ANALYSIS_FALLBACK.spike_skus).toEqual([]);
  });
});
