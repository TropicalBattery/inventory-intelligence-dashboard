import { cache } from "react";
import { fetchInboundContainerRows } from "@/lib/queries/inbound-containers";
import { TENANT_ID } from "@/lib/tenant";
import type { ReorderRecommendation } from "@/lib/types";

export type InboundBySupplierSummary = {
  containerCount: number;
  rowCount: number;
  /**
   * Earliest future ETA (ISO YYYY-MM-DD), or earliest known ETA when all are
   * already past. Null only when every container ETA is TBA / unparseable.
   */
  nextEtaPort: string | null;
  etaLabel: string;
  sourceMonth: string | null;
};

/** Attached to a recommendation when its supplier has inbound containers. */
export type ReorderInboundSummary = {
  containerCount: number;
  etaLabel: string;
  nextEtaPort: string | null;
};

/**
 * Known container-sheet name tokens → GP supplier codes.
 * Container names (e.g. "YIGIT AKU") often differ from GP vendor names.
 */
const SUPPLIER_INBOUND_ALIASES: ReadonlyArray<{
  token: string;
  codes: readonly string[];
}> = [
  { token: "YIGIT", codes: ["FY060"] },
  { token: "LEOCH", codes: ["FL050"] },
  { token: "FREEZETONE", codes: ["FF020"] },
];

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Uppercase, trim, strip punctuation — stable join key. */
export function normalizeSupplierKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse eta_port as a calendar date. Accepts ISO YYYY-MM-DD (and datetime
 * prefixes). Ignores TBA / blank / unparseable values.
 */
export function parseEtaPortDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const text = value.trim();
  if (!text || /^tba$/i.test(text)) {
    return null;
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
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
    // Noon UTC avoids DST edge cases when formatting calendar day.
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function formatDayMonthUtc(date: Date): string {
  return `${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]}`;
}

/** e.g. "16 Jul", "16-24 Jul", "16 Jul-3 Aug", or "ETA TBA". */
export function formatEtaLabel(dates: Date[]): string {
  if (dates.length === 0) {
    return "ETA TBA";
  }

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) {
    return "ETA TBA";
  }

  if (first.getTime() === last.getTime()) {
    return formatDayMonthUtc(first);
  }

  if (
    first.getUTCFullYear() === last.getUTCFullYear() &&
    first.getUTCMonth() === last.getUTCMonth()
  ) {
    return `${first.getUTCDate()}-${last.getUTCDate()} ${MONTH_SHORT[first.getUTCMonth()]}`;
  }

  return `${formatDayMonthUtc(first)}-${formatDayMonthUtc(last)}`;
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0)
  );
}

function toIsoDateUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type Acc = {
  containerCount: number;
  rowCount: number;
  dates: Date[];
  sourceMonth: string | null;
};

/**
 * One fetch of inbound_containers for the tenant, grouped by normalised
 * supplier name. Request-scoped via React cache.
 */
export const getInboundBySupplier = cache(
  async (): Promise<Map<string, InboundBySupplierSummary>> => {
    const map = new Map<string, InboundBySupplierSummary>();

    try {
      const rows = await fetchInboundContainerRows();
      const acc = new Map<string, Acc>();

      for (const row of rows) {
        // Arrived shipments no longer count toward inbound relief.
        if (row.status !== "inbound") {
          continue;
        }

        const key = normalizeSupplierKey(row.supplier);
        if (!key) {
          continue;
        }

        const current = acc.get(key) ?? {
          containerCount: 0,
          rowCount: 0,
          dates: [],
          sourceMonth: null,
        };

        const count =
          row.containerCount !== null && Number.isFinite(row.containerCount)
            ? Number(row.containerCount)
            : 0;
        current.containerCount += count;
        current.rowCount += 1;

        const eta = parseEtaPortDate(row.etaPort);
        if (eta) {
          current.dates.push(eta);
        }
        if (!current.sourceMonth && row.sourceMonth) {
          current.sourceMonth = row.sourceMonth;
        }

        acc.set(key, current);
      }

      const today = startOfTodayUtc();

      for (const [key, value] of Array.from(acc.entries())) {
        const sorted = [...value.dates].sort((a, b) => a.getTime() - b.getTime());
        const future = sorted.filter((d) => d.getTime() >= today.getTime());
        // Prefer earliest future ETA. When every known ETA is already past
        // (still-listed containers that should have landed), fall back to the
        // earliest past date so overdue relief can fire — previously
        // nextEtaPort was null and the cue fell through to "ETA TBA".
        const next = future[0] ?? sorted[0] ?? null;

        map.set(key, {
          containerCount: value.containerCount,
          rowCount: value.rowCount,
          nextEtaPort: next ? toIsoDateUtc(next) : null,
          etaLabel: formatEtaLabel(sorted),
          sourceMonth: value.sourceMonth,
        });
      }
    } catch (error) {
      console.error(
        `getInboundBySupplier failed for ${TENANT_ID}:`,
        error instanceof Error ? error.message : error
      );
    }

    return map;
  }
);

function summaryToRecInbound(
  summary: InboundBySupplierSummary
): ReorderInboundSummary {
  return {
    containerCount: summary.containerCount,
    etaLabel: summary.etaLabel,
    nextEtaPort: summary.nextEtaPort,
  };
}

/**
 * Resolve inbound summary for a recommendation via name, GP name map, and
 * known aliases. Returns null when the supplier has nothing inbound.
 */
export function resolveInboundForRecommendation(
  rec: Pick<ReorderRecommendation, "supplierName" | "supplierExternalId">,
  inboundBySupplier: Map<string, InboundBySupplierSummary>,
  nameMap: Map<string, string>
): ReorderInboundSummary | null {
  if (inboundBySupplier.size === 0) {
    return null;
  }

  const candidates = new Set<string>();

  const pushName = (name: string | null | undefined) => {
    if (!name) return;
    const key = normalizeSupplierKey(name);
    if (key) candidates.add(key);
  };

  pushName(rec.supplierName);
  if (rec.supplierExternalId) {
    pushName(nameMap.get(rec.supplierExternalId));
  }

  // Exact normalised key hit.
  for (const key of Array.from(candidates)) {
    const hit = inboundBySupplier.get(key);
    if (hit) {
      return summaryToRecInbound(hit);
    }
  }

  // Contains match either direction (e.g. "YIGIT AKU" vs "YIGIT AKU CORP").
  for (const [inboundKey, summary] of Array.from(inboundBySupplier.entries())) {
    for (const candidate of Array.from(candidates)) {
      if (
        candidate.length >= 4 &&
        inboundKey.length >= 4 &&
        (inboundKey.includes(candidate) || candidate.includes(inboundKey))
      ) {
        return summaryToRecInbound(summary);
      }
    }
  }

  // Alias: container token ↔ GP code.
  const code = rec.supplierExternalId?.trim().toUpperCase() ?? "";
  for (const alias of SUPPLIER_INBOUND_ALIASES) {
    const codeMatch = alias.codes.some((c) => c.toUpperCase() === code);
    const nameMatch = Array.from(candidates).some(
      (c) => c === alias.token || c.includes(alias.token)
    );
    if (!codeMatch && !nameMatch) {
      continue;
    }

    for (const [inboundKey, summary] of Array.from(
      inboundBySupplier.entries()
    )) {
      if (inboundKey === alias.token || inboundKey.includes(alias.token)) {
        return summaryToRecInbound(summary);
      }
    }
  }

  return null;
}

export function attachInboundToRecommendations(
  recommendations: ReorderRecommendation[],
  inboundBySupplier: Map<string, InboundBySupplierSummary>,
  nameMap: Map<string, string>
): ReorderRecommendation[] {
  return recommendations.map((rec) => ({
    ...rec,
    inbound: resolveInboundForRecommendation(rec, inboundBySupplier, nameMap),
  }));
}
