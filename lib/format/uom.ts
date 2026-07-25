import { formatNumber } from "@/lib/format";

/**
 * Best-effort parse of products.unit_of_measure.
 * Authoritative case quantities may later come from a GP QTYBSUOM sync;
 * until then, NxM codes (e.g. ACC_12X1) are the pack-ratio source.
 */
export type PackInfo = {
  baseUnit: string;
  unitsPerCase: number | null;
  raw: string;
  label: string;
};

const PACK_RATIO_PATTERN = /(\d+)\s*[xX]\s*(\d+)/;

function emptyPackInfo(raw = ""): PackInfo {
  return {
    baseUnit: "ea",
    unitsPerCase: null,
    raw,
    label: "",
  };
}

export function parseUom(uom: string | null | undefined): PackInfo {
  if (uom === null || uom === undefined) {
    return emptyPackInfo();
  }

  const raw = uom.trim();
  if (!raw) {
    return emptyPackInfo();
  }

  const ratioMatch = raw.match(PACK_RATIO_PATTERN);
  if (ratioMatch) {
    const unitsPerCase = Number(ratioMatch[1]);
    if (Number.isFinite(unitsPerCase) && unitsPerCase > 0) {
      return {
        baseUnit: "ea",
        unitsPerCase,
        raw,
        // Underlying qty is still each; pack ratio is shown separately, not as a row suffix.
        label: "ea",
      };
    }
  }

  const normalized = raw.toUpperCase();
  if (normalized === "EACH" || normalized === "UNIT") {
    return {
      baseUnit: "ea",
      unitsPerCase: null,
      raw,
      label: "ea",
    };
  }

  // Clean single-word units (PAIL, Set, Pair, …) — use lowercased label, no case qty.
  if (/^[A-Za-z]+$/.test(raw)) {
    const label = raw.toLowerCase();
    return {
      baseUnit: label,
      unitsPerCase: null,
      raw,
      label,
    };
  }

  // Unparseable schedule codes (CAS-55GL, RAWMAT_2, TUBE H-K, …) — suppress suffix.
  return {
    baseUnit: "ea",
    unitsPerCase: null,
    raw,
    label: "",
  };
}

type FormatQtyWithUomOptions = {
  /** When false (default), omit a bare "ea" suffix so rows stay number-dominant. */
  showEachSuffix?: boolean;
};

export function formatQtyWithUom(
  qty: number,
  uom: string | null | undefined,
  options: FormatQtyWithUomOptions = {}
): string {
  const showEachSuffix = options.showEachSuffix ?? false;
  const formatted = formatNumber(qty);
  const pack = parseUom(uom);

  if (!pack.label) {
    return formatted;
  }

  if (pack.label === "ea" && !showEachSuffix) {
    return formatted;
  }

  return `${formatted} ${pack.label}`;
}

/**
 * Muted helper under a qty when a case pack is known.
 * Exact multiples → "= {n} cases"; otherwise → "~{n} cases ({qty} units)".
 */
export function formatCasesHelper(
  qty: number,
  unitsPerCase: number
): string | null {
  if (
    !Number.isFinite(qty) ||
    qty <= 0 ||
    !Number.isFinite(unitsPerCase) ||
    unitsPerCase <= 0
  ) {
    return null;
  }

  const exact = qty % unitsPerCase === 0;
  if (exact) {
    const cases = qty / unitsPerCase;
    return `= ${formatNumber(cases)} case${cases === 1 ? "" : "s"}`;
  }

  const cases = Math.round(qty / unitsPerCase);
  return `~${formatNumber(cases)} case${cases === 1 ? "" : "s"} (${formatNumber(qty)} units)`;
}

export function formatPackChip(unitsPerCase: number): string {
  return `${formatNumber(unitsPerCase)}/cs`;
}
