import { describe, expect, it } from "vitest";
import { inboundReliefStatus } from "@/lib/reorder/inbound-relief";

describe("inboundReliefStatus", () => {
  const today = new Date(Date.UTC(2026, 6, 25, 15, 0, 0)); // 25 Jul 2026

  it("returns null when supplier has nothing inbound", () => {
    expect(inboundReliefStatus({ inbound: null }, today)).toBeNull();
    expect(inboundReliefStatus({}, today)).toBeNull();
  });

  it("returns overdue when nextEtaPort is in the past (Yigit case)", () => {
    const relief = inboundReliefStatus(
      {
        inbound: {
          containerCount: 11,
          etaLabel: "16-24 Jul",
          nextEtaPort: "2026-07-16",
        },
      },
      today
    );
    expect(relief).toEqual({
      kind: "overdue",
      daysToEta: -9,
      label: "ETA passed - check receiving",
    });
  });

  it("treats null nextEtaPort with containers as TBA inbound (not null)", () => {
    // Pre-fix aggregation path: all-past ETAs left nextEtaPort null.
    const relief = inboundReliefStatus(
      {
        inbound: {
          containerCount: 11,
          etaLabel: "16-24 Jul",
          nextEtaPort: null,
        },
      },
      today
    );
    expect(relief).toEqual({
      kind: "inbound",
      daysToEta: null,
      label: "inbound ETA TBA",
    });
  });

  it("returns imminent within 14 days", () => {
    const relief = inboundReliefStatus(
      {
        inbound: {
          containerCount: 1,
          etaLabel: "30 Jul",
          nextEtaPort: "2026-07-30",
        },
      },
      today
    );
    expect(relief?.kind).toBe("imminent");
    expect(relief?.daysToEta).toBe(5);
    expect(relief?.label).toBe("arriving ~5d");
  });

  it("returns inbound beyond 14 days", () => {
    const relief = inboundReliefStatus(
      {
        inbound: {
          containerCount: 2,
          etaLabel: "20 Aug",
          nextEtaPort: "2026-08-20",
        },
      },
      today
    );
    expect(relief).toEqual({
      kind: "inbound",
      daysToEta: 26,
      label: "inbound 20 Aug",
    });
  });
});
