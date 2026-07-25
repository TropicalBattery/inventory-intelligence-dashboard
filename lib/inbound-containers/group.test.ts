import { describe, expect, it } from "vitest";
import { groupInboundContainers } from "@/lib/inbound-containers/group";
import type { InboundContainerRecord } from "@/lib/inbound-containers/group";

function row(
  partial: Partial<InboundContainerRecord> &
    Pick<InboundContainerRecord, "id" | "supplier">
): InboundContainerRecord {
  return {
    tenantId: "t1",
    supplierInvoice: "INV",
    quoteRef: null,
    containerCount: 1,
    containerSize: "20FT",
    etaPort: null,
    etaWarehouse: null,
    blNumber: null,
    containerNumbers: null,
    sourceMonth: "JULY 2026",
    loadedAt: "2026-07-25T00:00:00.000Z",
    entrySource: "upload",
    status: "inbound",
    arrivedAt: null,
    createdBy: null,
    updatedBy: null,
    updatedAt: null,
    ...partial,
  };
}

describe("groupInboundContainers", () => {
  it("sums container counts and only buckets real FT sizes", () => {
    const summary = groupInboundContainers([
      row({ id: "1", supplier: "Yigit", containerCount: 11, containerSize: "20FT" }),
      row({ id: "2", supplier: "Freezetone", containerCount: 1, containerSize: "40FT" }),
      row({ id: "3", supplier: "Leoch", containerCount: 1, containerSize: "20FT" }),
      // Stray tokens must not become size pills
      row({ id: "4", supplier: "Ghost", containerCount: 0, containerSize: "11" }),
      row({ id: "5", supplier: "Ghost", containerCount: 0, containerSize: "13" }),
      row({ id: "6", supplier: "Ghost", containerCount: 0, containerSize: "0P" }),
    ]);

    expect(summary.totalContainers).toBe(13);
    expect(summary.bySize).toEqual({ "20FT": 12, "40FT": 1 });
    expect(summary.bySize).not.toHaveProperty("11");
    expect(summary.bySize).not.toHaveProperty("13");
    expect(summary.bySize).not.toHaveProperty("0P");
  });

  it("sorts inbound rows before arrived within a supplier group", () => {
    const summary = groupInboundContainers([
      row({
        id: "arrived",
        supplier: "Yigit",
        status: "arrived",
        etaPort: "2026-07-10",
      }),
      row({
        id: "inbound",
        supplier: "Yigit",
        status: "inbound",
        etaPort: "2026-07-20",
      }),
    ]);

    expect(summary.groups[0]?.rows.map((r) => r.id)).toEqual([
      "inbound",
      "arrived",
    ]);
  });

  it("counts only inbound for totalContainers and tracks arrived separately", () => {
    const summary = groupInboundContainers([
      row({
        id: "1",
        supplier: "Yigit",
        containerCount: 11,
        containerSize: "20FT",
        status: "inbound",
      }),
      row({
        id: "2",
        supplier: "Yigit",
        containerCount: 2,
        containerSize: "40FT",
        status: "arrived",
      }),
    ]);

    expect(summary.totalContainers).toBe(11);
    expect(summary.arrivedContainers).toBe(2);
    expect(summary.bySize).toEqual({ "20FT": 11 });
    expect(summary.groups[0]?.containerCountTotal).toBe(11);
    expect(summary.groups[0]?.arrivedCountTotal).toBe(2);
  });
});
