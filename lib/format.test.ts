import { describe, expect, it } from "vitest";
import {
  formatCurrencyJMD,
  formatSuggestedQty,
  formatSyncRunDuration,
} from "@/lib/format";

describe("formatCurrencyJMD", () => {
  it("returns a formatted JMD value for valid numbers", () => {
    expect(formatCurrencyJMD(1234.5)).toBe("J$1,234.50");
  });

  it('returns "-" for null, undefined, and NaN', () => {
    expect(formatCurrencyJMD(null)).toBe("-");
    expect(formatCurrencyJMD(undefined)).toBe("-");
    expect(formatCurrencyJMD(Number.NaN)).toBe("-");
  });
});

describe("formatSuggestedQty", () => {
  it('returns "-" for zero, null, undefined, and negative values', () => {
    expect(formatSuggestedQty(0)).toBe("-");
    expect(formatSuggestedQty(null)).toBe("-");
    expect(formatSuggestedQty(undefined)).toBe("-");
    expect(formatSuggestedQty(-5)).toBe("-");
  });

  it("formats positive quantities", () => {
    expect(formatSuggestedQty(100)).toBe("100");
  });
});

describe("formatSyncRunDuration", () => {
  it("shows one decimal second for sub-minute durations", () => {
    expect(formatSyncRunDuration(300)).toBe("0.3s");
    expect(formatSyncRunDuration(450)).toBe("0.5s");
  });

  it("shows minutes and seconds for longer durations", () => {
    expect(formatSyncRunDuration(90000)).toBe("1m 30s");
  });
});
