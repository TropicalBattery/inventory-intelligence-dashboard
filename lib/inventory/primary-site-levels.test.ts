import { describe, expect, it } from "vitest";
import {
  applyPrimarySiteLevels,
  getPrimarySiteExternalId,
  isPrimarySiteBalanceRow,
} from "@/lib/inventory/primary-site-levels";
import { buildReorderPreviewItems } from "@/lib/queries/dashboard";

describe("primary site inventory levels", () => {
  it("identifies the GP primary inventory row by external_id", () => {
    expect(getPrimarySiteExternalId("96L928")).toBe("96L928-");
    expect(
      isPrimarySiteBalanceRow({
        sku: "96L928",
        external_id: "96L928-",
      })
    ).toBe(true);
    expect(
      isPrimarySiteBalanceRow({
        sku: "96L928",
        external_id: "96L928-W/H - KGN",
      })
    ).toBe(false);
  });

  it("overrides aggregated reorder levels with primary-site values", () => {
    const rows = applyPrimarySiteLevels(
      [
        {
          sku: "96L928",
          reorder_level: 5274,
          maximum_stock_level: 0,
        },
      ],
      new Map([
        [
          "96L928",
          {
            reorderLevel: 0,
            maximumStockLevel: 0,
          },
        ],
      ])
    );

    expect(rows[0]?.reorder_level).toBe(0);
  });
});

describe("buildReorderPreviewItems", () => {
  it("counts only items below a positive reorder level", () => {
    const items = buildReorderPreviewItems([
      {
        sku: "96L928",
        name: "Battery",
        quantity_available: 0,
        quantity_on_hand: 0,
        reorder_level: 0,
      },
      {
        sku: "96807L",
        name: "Battery",
        quantity_available: 0,
        quantity_on_hand: 0,
        reorder_level: 200,
      },
      {
        sku: "IN-STOCK",
        name: "Battery",
        quantity_available: 50,
        quantity_on_hand: 50,
        reorder_level: 20,
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]?.sku).toBe("96807L");
    expect(items[0]?.shortfall).toBe(200);
  });
});
