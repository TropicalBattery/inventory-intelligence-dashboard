import { describe, expect, it } from "vitest";
import { toNumber } from "@/lib/format";

describe("toNumber", () => {
  it("parses numeric strings from Supabase", () => {
    expect(toNumber("2099")).toBe(2099);
    expect(toNumber("6550.5")).toBe(6550.5);
  });

  it("returns 0 for nullish and invalid values", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber("not-a-number")).toBe(0);
  });
});

describe("dashboard inventory totals", () => {
  it("sums quantity_on_hand without string concatenation", () => {
    const rows = [
      { quantity_on_hand: "2099" },
      { quantity_on_hand: "6550" },
      { quantity_on_hand: "9336" },
      { quantity_on_hand: "3478" },
      { quantity_on_hand: "1258" },
    ];

    const total = rows.reduce(
      (sum, row) => sum + toNumber(row.quantity_on_hand),
      0
    );

    expect(total).toBe(22721);
  });
});
