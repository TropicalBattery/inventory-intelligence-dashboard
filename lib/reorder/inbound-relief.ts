/**
 * ETA-aware inbound relief cues for the reorder list.
 *
 * Pure presentation helper — does NOT change status classification or cover
 * math. An item stays Critical/Watch; this only layers advisory context so a
 * buyer can tell "critical with nothing coming" from "critical but a
 * container is arriving / overdue".
 *
 * Rationale for `overdue`: an overdue ETA on a still-critical item means the
 * container should have landed but the stock is not showing (not yet received
 * into GP, or the shipment slipped). That is an actionable chase — the most
 * useful of the three signals.
 */

export type InboundRelief = {
  kind: "imminent" | "inbound" | "overdue";
  /** Calendar days from today to next ETA; negative if past. Null when TBA. */
  daysToEta: number | null;
  label: string;
} | null;

type InboundReliefInput = {
  inbound?: {
    nextEtaPort: string | null;
    etaLabel: string;
    containerCount: number;
  } | null;
};

function parseNextEtaPort(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const text = value.trim();
  if (!text || /^tba$/i.test(text)) {
    return null;
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!iso) {
    return null;
  }

  const year = Number(iso[1]);
  const month = Number(iso[2]);
  const day = Number(iso[3]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  // Noon UTC avoids DST edge cases on calendar-day diffs.
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function utcCalendarDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

/** Whole calendar days from `from` to `to` (UTC). Negative if `to` is past. */
function calendarDaysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (utcCalendarDay(to).getTime() - utcCalendarDay(from).getTime()) / msPerDay
  );
}

/**
 * Derive an inbound-relief cue from supplier-level container ETA data already
 * attached to the recommendation. Returns null when the supplier has nothing
 * inbound.
 */
export function inboundReliefStatus(
  rec: InboundReliefInput,
  today: Date = new Date()
): InboundRelief {
  const inbound = rec.inbound;
  if (!inbound || inbound.containerCount <= 0) {
    return null;
  }

  const eta = parseNextEtaPort(inbound.nextEtaPort);
  if (!eta) {
    return {
      kind: "inbound",
      daysToEta: null,
      label: "inbound ETA TBA",
    };
  }

  const daysToEta = calendarDaysBetween(today, eta);

  if (daysToEta < 0) {
    return {
      kind: "overdue",
      daysToEta,
      label: "ETA passed - check receiving",
    };
  }

  if (daysToEta <= 14) {
    return {
      kind: "imminent",
      daysToEta,
      label: `arriving ~${daysToEta}d`,
    };
  }

  return {
    kind: "inbound",
    daysToEta,
    label: `inbound ${inbound.etaLabel}`,
  };
}
