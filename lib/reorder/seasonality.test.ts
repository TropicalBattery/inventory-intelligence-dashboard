import { describe, expect, it } from "vitest";
import {
  detectSeasonality,
  formatPeakLabel,
  contiguousRuns,
  type SeasonalityMonthInput,
} from "@/lib/reorder/seasonality";

const referenceDate = new Date(Date.UTC(2026, 6, 13)); // 2026-07-13

function month(year: number, monthIndex0: number, units: number): SeasonalityMonthInput {
  return {
    salesMonth: new Date(Date.UTC(year, monthIndex0, 1)),
    units,
  };
}

/** Flat base of 100 units for Jul 2025 – Jun 2026 (12 complete months before Jul 2026). */
function flatYear(overrides: SeasonalityMonthInput[] = []): SeasonalityMonthInput[] {
  const rows: SeasonalityMonthInput[] = [];
  // Jul 2025 (6) through Jun 2026 (5)
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(Date.UTC(2025, 6 + i, 1));
    rows.push({
      salesMonth: d,
      units: 100,
    });
  }
  const byKey = new Map(
    rows.map((r) => [r.salesMonth.getTime(), r] as const)
  );
  for (const o of overrides) {
    byKey.set(o.salesMonth.getTime(), o);
  }
  return Array.from(byKey.values());
}

describe("contiguousRuns / formatPeakLabel", () => {
  it("treats Nov-Dec-Jan as one run", () => {
    expect(contiguousRuns([11, 12, 1])).toEqual([[11, 12, 1]]);
    expect(formatPeakLabel([11, 12, 1])).toBe("Nov-Jan");
  });

  it("formats single and multi-run labels", () => {
    expect(formatPeakLabel([12])).toBe("Dec");
    expect(formatPeakLabel([3, 4, 9])).toBe("Mar-Apr, Sep");
  });
});

describe("detectSeasonality", () => {
  it("flags a clear December peak (2x flat baseline)", () => {
    // Dec at 2x baseline; overall avg includes Dec so strength ≈ 1.8×
    const rows = flatYear([month(2025, 11, 200)]); // Dec 2025
    const result = detectSeasonality(rows, referenceDate);

    expect(result.isSeasonal).toBe(true);
    expect(result.peakMonths).toEqual([12]);
    expect(result.peakLabel).toBe("Dec");
    expect(result.strength).toBe(1.8);
    expect(result.historyMonths).toBe(12);
  });

  it("treats Nov-Jan across year boundary as one contiguous run", () => {
    const rows = flatYear([
      month(2025, 10, 200), // Nov
      month(2025, 11, 200), // Dec
      month(2026, 0, 200), // Jan
    ]);
    const result = detectSeasonality(rows, referenceDate);

    expect(result.isSeasonal).toBe(true);
    expect(result.peakMonths).toEqual([1, 11, 12]);
    expect(result.peakLabel).toBe("Nov-Jan");
  });

  it("returns not seasonal for a flat seller", () => {
    const result = detectSeasonality(flatYear(), referenceDate);
    expect(result.isSeasonal).toBe(false);
    expect(result.peakLabel).toBeNull();
    expect(result.strength).toBeNull();
  });

  it("returns not seasonal with only 6 months of history", () => {
    const rows = [
      month(2026, 0, 100),
      month(2026, 1, 100),
      month(2026, 2, 100),
      month(2026, 3, 200),
      month(2026, 4, 100),
      month(2026, 5, 100),
    ];
    const result = detectSeasonality(rows, referenceDate);
    expect(result.isSeasonal).toBe(false);
    expect(result.historyMonths).toBe(6);
  });

  it("returns not seasonal for 6 scattered peak months (noisy)", () => {
    // Spikes high enough to clear 1.4× overall avg → 6 singleton runs
    const rows = flatYear([
      month(2025, 6, 250), // Jul
      month(2025, 8, 250), // Sep
      month(2025, 10, 250), // Nov
      month(2026, 0, 250), // Jan
      month(2026, 2, 250), // Mar
      month(2026, 4, 250), // May
    ]);
    const result = detectSeasonality(rows, referenceDate);
    expect(result.isSeasonal).toBe(false);
  });

  it("excludes the current partial month from detection", () => {
    const withCurrentSpike = [
      ...flatYear(),
      month(2026, 6, 500), // Jul 2026 — incomplete, must be ignored
    ];
    const result = detectSeasonality(withCurrentSpike, referenceDate);
    expect(result.isSeasonal).toBe(false);

    const withJuneSpike = flatYear([month(2026, 5, 200)]);
    const juneResult = detectSeasonality(withJuneSpike, referenceDate);
    expect(juneResult.isSeasonal).toBe(true);
    expect(juneResult.peakLabel).toBe("Jun");
  });
});
