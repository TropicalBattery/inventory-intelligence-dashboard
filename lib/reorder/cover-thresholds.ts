/**
 * Months-of-cover status band thresholds.
 * Prefer lead-time-relative bands via resolveCoverBands(); these globals are
 * the fallback when no effective lead time is on file.
 */
export const COVER_CRITICAL_MONTHS = 1;
export const COVER_WATCH_MONTHS = 2;
export const COVER_OK_MONTHS = 6;

/**
 * Lead-time-relative band multiples (cover measured in months of demand).
 * Cover below one full replenishment cycle means a stockout is possible
 * before a new order arrives (Critical). Watch spans the ordering window
 * (1.0x–1.5x lead time). OK uses 3x lead time, floored at COVER_OK_MONTHS
 * so short-lead items do not collapse the overstock boundary.
 */
export const LEADTIME_CRITICAL_MULTIPLE = 1.0;
export const LEADTIME_WATCH_MULTIPLE = 1.5;
export const LEADTIME_OK_MULTIPLE = 3.0;

/**
 * Months of cover above the OK band are treated as overstock.
 * COVER_OK_MONTHS is the OK floor (>= 6 months = status ok);
 * OVERSTOCK_MONTHS matches that ceiling so overstock means strictly
 * more than the OK threshold (cover > OVERSTOCK_MONTHS).
 */
export const OVERSTOCK_MONTHS = COVER_OK_MONTHS;

/** Average days per month for converting daily demand to monthly. */
export const DAYS_PER_MONTH = 30.44;

/**
 * 5274 is a known bulk data-entry error in GP ORDRPNTQTY.
 * Treated as unset. Client (Daniel) to correct in GP;
 * list of affected items pending.
 */
export const DIRTY_REORDER_LEVEL_SENTINEL = 5274;

/** Demand months used when GP reorder level is unset/dirty. */
export const DEFAULT_REORDER_MONTHS = 3;

/**
 * Rolling calendar-month window for stockout-adjusted demand
 * (selling-months-only rate). Also the platform preference for
 * recent demand (LOGIC-02).
 */
export const DEMAND_WINDOW_MONTHS = 6;

/** Minimum selling months inside the window before adjusting demand. */
export const MIN_SELLING_MONTHS_FOR_ADJUSTED_DEMAND = 3;

/**
 * Show the expanded-panel demand-adjustment note when adjusted
 * daily demand differs from raw item_costing by more than this ratio.
 */
export const DEMAND_ADJUSTMENT_DISPLAY_THRESHOLD = 0.25;

export type LeadTimeSource =
  | "locked_vendor"
  | "priority_vendor"
  | "any_vendor"
  | null;

export type CoverBands = {
  criticalBelow: number;
  watchBelow: number;
  okBelow: number;
};

export type EffectiveLeadTimeResolution = {
  days: number | null;
  source: LeadTimeSource;
  supplierExternalId: string | null;
};

export type EffectiveLeadTimeSupplierRow = {
  supplier_external_id: string;
  lead_time_days: number | null;
  is_priority_vendor: boolean;
};

export function standardCoverBands(): CoverBands {
  return {
    criticalBelow: COVER_CRITICAL_MONTHS,
    watchBelow: COVER_WATCH_MONTHS,
    okBelow: COVER_OK_MONTHS,
  };
}

export function resolveCoverBands(
  effectiveLeadTimeDays: number | null
): CoverBands {
  if (
    effectiveLeadTimeDays === null ||
    !Number.isFinite(effectiveLeadTimeDays) ||
    effectiveLeadTimeDays <= 0
  ) {
    return standardCoverBands();
  }

  const leadMonths = effectiveLeadTimeDays / DAYS_PER_MONTH;
  return {
    criticalBelow: leadMonths * LEADTIME_CRITICAL_MULTIPLE,
    watchBelow: leadMonths * LEADTIME_WATCH_MULTIPLE,
    okBelow: Math.max(leadMonths * LEADTIME_OK_MULTIPLE, COVER_OK_MONTHS),
  };
}

/**
 * Effective replenishment lead time for status banding.
 * Order: locked vendor → priority vendor → min positive lead across refs.
 */
export function resolveEffectiveLeadTime(
  rows: ReadonlyArray<EffectiveLeadTimeSupplierRow>,
  lockedVendorId: string | null | undefined
): EffectiveLeadTimeResolution {
  const positiveDays = (value: number | null | undefined): number | null => {
    if (value === null || value === undefined) {
      return null;
    }
    return Number.isFinite(value) && value > 0 ? value : null;
  };

  if (lockedVendorId) {
    const locked = rows.find(
      (row) => row.supplier_external_id === lockedVendorId
    );
    const days = positiveDays(locked?.lead_time_days ?? null);
    if (days !== null && locked) {
      return {
        days,
        source: "locked_vendor",
        supplierExternalId: locked.supplier_external_id,
      };
    }
  }

  const priority = rows.find((row) => row.is_priority_vendor);
  const priorityDays = positiveDays(priority?.lead_time_days ?? null);
  if (priority && priorityDays !== null) {
    return {
      days: priorityDays,
      source: "priority_vendor",
      supplierExternalId: priority.supplier_external_id,
    };
  }

  let minDays: number | null = null;
  let minSupplier: string | null = null;
  for (const row of rows) {
    const days = positiveDays(row.lead_time_days);
    if (days === null) {
      continue;
    }
    if (minDays === null || days < minDays) {
      minDays = days;
      minSupplier = row.supplier_external_id;
    }
  }

  if (minDays !== null) {
    return {
      days: minDays,
      source: "any_vendor",
      supplierExternalId: minSupplier,
    };
  }

  return { days: null, source: null, supplierExternalId: null };
}

export function sanitizeReorderLevel(
  rawReorderLevel: number | null | undefined
): number | null {
  if (rawReorderLevel === null || rawReorderLevel === undefined) {
    return null;
  }

  if (rawReorderLevel <= 0) {
    return null;
  }

  if (rawReorderLevel === DIRTY_REORDER_LEVEL_SENTINEL) {
    return null;
  }

  return rawReorderLevel;
}

export function computeDefaultReorderLevel(avgDailyDemandUnits: number): number {
  return avgDailyDemandUnits * DAYS_PER_MONTH * DEFAULT_REORDER_MONTHS;
}
