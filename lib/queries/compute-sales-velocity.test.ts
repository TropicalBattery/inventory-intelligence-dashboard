import { describe, expect, it } from "vitest";
import { computeSalesVelocityRows } from "@/lib/queries/compute-sales-velocity";

describe("computeSalesVelocityRows", () => {
  const referenceDate = new Date("2026-06-12T12:00:00.000Z");

  it("computes rolling windows and derived trend fields", () => {
    const rows = computeSalesVelocityRows(
      [{ tenant_id: "tropical-battery", sku: "SKU-001" }],
      [
        {
          sku: "SKU-001",
          quantity_sold: 30,
          transaction_date: "2026-06-01T00:00:00.000Z",
        },
        {
          sku: "SKU-001",
          quantity_sold: 20,
          transaction_date: "2026-05-01T00:00:00.000Z",
        },
        {
          sku: "SKU-001",
          quantity_sold: 10,
          transaction_date: "2026-04-01T00:00:00.000Z",
        },
        {
          sku: "SKU-001",
          quantity_sold: 600,
          transaction_date: "2025-07-01T00:00:00.000Z",
        },
      ],
      "tropical-battery",
      referenceDate
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.units_sold_last_30d).toBe(30);
    expect(rows[0]?.units_sold_31_60d).toBe(20);
    expect(rows[0]?.units_sold_61_90d).toBe(10);
    expect(rows[0]?.avg_monthly_last_3m).toBe(20);
    expect(rows[0]?.avg_monthly_trailing_12m).toBe(55);
    expect(rows[0]?.velocity_trend_pct).toBeCloseTo(-63.64, 2);
    expect(rows[0]?.days_since_last_sale).toBe(11);
  });
});
