import type { AbcClass } from "@/lib/reorder/abc";
import type {
  CoverBands,
  LeadTimeSource,
} from "@/lib/reorder/cover-thresholds";

export type { AbcClass, CoverBands, LeadTimeSource };

export type SupplierReliabilityRating =
  | "Preferred"
  | "Approved"
  | "Conditional";

export const SUPPLIER_RELIABILITY_RATINGS: SupplierReliabilityRating[] = [
  "Preferred",
  "Approved",
  "Conditional",
];

export type ItemSupplierReference = {
  id: string;
  tenant_id: string;
  sku: string;
  supplier_external_id: string;
  vendor_item_number: string | null;
  lead_time_days: number | null;
  safety_stock_months: number | null;
  qty_in_transit: number | null;
  qty_in_bond: number | null;
  qty_at_port: number | null;
  qty_in_clearing: number | null;
  pallet_qty: number | null;
  container_qty: number | null;
  is_priority_vendor: boolean;
  ordering_cost_per_order: number | null;
  holding_cost_per_unit_year: number | null;
  unit_price: number | null;
  currency: string | null;
  reliability_rating: SupplierReliabilityRating | null;
  supplier_region: string | null;
  min_order_qty: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ItemSupplierReferenceInput = {
  sku: string;
  supplier_external_id: string;
  vendor_item_number: string | null;
  lead_time_days: number | null;
  safety_stock_months: number | null;
  qty_in_transit: number | null;
  qty_in_bond: number | null;
  qty_at_port: number | null;
  qty_in_clearing: number | null;
  pallet_qty: number | null;
  container_qty: number | null;
  is_priority_vendor: boolean;
  ordering_cost_per_order: number | null;
  holding_cost_per_unit_year: number | null;
  unit_price: number | null;
  currency: string;
  reliability_rating: SupplierReliabilityRating | null;
  supplier_region: string | null;
  min_order_qty: number | null;
  notes: string | null;
};

export type ItemSupplierReferenceRow = ItemSupplierReference & {
  product_name: string | null;
  supplier_name: string | null;
  hasQuoteOnFile?: boolean;
};

export type ProductOption = {
  sku: string;
  name: string | null;
};

export type SupplierOption = {
  external_id: string;
  name: string | null;
};

export type ReferenceDataActionResult = {
  success: boolean;
  error?: string;
};

export const REFERENCE_DATA_PAGE_SIZE = 50;

export const NUMERIC_REFERENCE_FIELDS = [
  "lead_time_days",
  "safety_stock_months",
  "qty_in_transit",
  "qty_in_bond",
  "qty_at_port",
  "qty_in_clearing",
  "min_order_qty",
  "pallet_qty",
  "container_qty",
  "ordering_cost_per_order",
  "holding_cost_per_unit_year",
  "unit_price",
] as const;

export type NumericReferenceField = (typeof NUMERIC_REFERENCE_FIELDS)[number];

export type ReorderStatus =
  | "critical"
  | "watch"
  | "reorder_needed"
  | "ok"
  | "no_demand";

export type RoundingUnit = "container" | "pallet" | "unit";

/**
 * Stable why-suggested-qty-is-zero (or blocked) signal for UI / overrides.
 * Additive to free-text dataGaps; does not change suggested qty math.
 */
export type SuggestedQtyZeroReason =
  | "already_covered" // effectiveStock >= reorderThreshold
  | "no_demand" // no demand data — engine has no target
  | "no_target" // demand exists but no EOQ / reorder-level / lead-time path
  | "blocked_rule"; // discontinue / do_not_buy purchase rule

export type ItemPurchaseRuleType =
  | "discontinue"
  | "do_not_buy"
  | "vendor_lock";

export type ItemPurchaseRule = {
  ruleType: ItemPurchaseRuleType;
  lockedVendorId: string | null;
};

/**
 * v1 SKU seasonality from monthly sales (see lib/reorder/seasonality.ts).
 * Peak flags are single-cycle evidence until multi-year history accumulates.
 */
export type SeasonalityResult = {
  isSeasonal: boolean;
  peakMonths: number[];
  peakLabel: string | null;
  strength: number | null;
  /** Complete months used after excluding the current incomplete month. */
  historyMonths: number;
};

export type VwReorderInputsRow = {
  tenant_id: string;
  sku: string;
  name: string | null;
  item_class: string | null;
  category: string | null;
  /** products.unit_of_measure (may encode NxM pack ratios). */
  unit_of_measure: string | null;
  quantity_on_hand: number | null;
  quantity_available: number | null;
  quantity_allocated: number | null;
  effective_available: number | null;
  quantity_on_order: number | null;
  quantity_in_transit: number | null;
  quantity_in_bond: number | null;
  quantity_at_port: number | null;
  quantity_in_clearing: number | null;
  reorder_level: number | null;
  maximum_stock_level: number | null;
  annual_demand_units: number | null;
  avg_daily_demand_units: number | null;
  /** Pre-adjustment avg daily from item_costing when demand was overridden. */
  raw_avg_daily_demand_units: number | null;
  /** Months in DEMAND_WINDOW_MONTHS with no sales when demand was adjusted. */
  stockout_months_excluded: number | null;
  ordering_cost_per_order: number | null;
  holding_cost_per_unit_year: number | null;
  current_cost_local: number | null;
  best_supplier_external_id: string | null;
  best_unit_price: number | null;
  lead_time_days: number | null;
  /**
   * Lead time used for cover banding (locked → priority → min).
   * Null when no positive lead time on file → standard bands.
   */
  effective_lead_time_days: number | null;
  lead_time_source: LeadTimeSource;
  /** Supplier that supplied effective_lead_time_days. */
  effective_lead_time_supplier_external_id: string | null;
  safety_stock_months: number | null;
  pallet_qty: number | null;
  container_qty: number | null;
  /** Soft workflow flag from active_inventory_whitelist (empty table → true). */
  is_whitelisted: boolean;
  /** Buyer priority from Order Tool (1 = highest). Null when unknown / fallback. */
  buyer_rank: number | null;
  /** Buyer purchase constraint from item_purchase_rules, if any. */
  purchase_rule: ItemPurchaseRule | null;
  /** Auto-detected from vw_monthly_sales_by_sku; null when no monthly history. */
  seasonality: SeasonalityResult | null;
};

export type ReorderRecommendation = {
  tenantId: string;
  sku: string;
  name: string | null;
  itemClass: string | null;
  category: string | null;
  /** Raw products.unit_of_measure; parse with parseUom for pack display. */
  unitOfMeasure: string | null;
  isActive: boolean | null;
  /** Soft workflow flag from active_inventory_whitelist (empty table → true). */
  isWhitelisted: boolean;
  /** Buyer priority from Order Tool (1 = highest). Null when unknown / fallback. */
  buyerRank: number | null;
  /** Buyer purchase constraint from item_purchase_rules, if any. */
  purchaseRule?: ItemPurchaseRule | null;
  quantityOnHand: number;
  quantityAvailable: number;
  quantityAllocated: number;
  effectiveAvailable: number;
  quantityOnOrder: number;
  quantityInPipeline: number;
  pipelineBreakdown: {
    inTransit: number;
    inBond: number;
    atPort: number;
    inClearing: number;
  };
  reorderLevel: number | null;
  maximumStockLevel: number | null;
  annualDemandUnits: number | null;
  avgDailyDemandUnits: number | null;
  /** Pre-adjustment avg daily from item_costing when demand was overridden. */
  rawAvgDailyDemandUnits: number | null;
  /** Months in DEMAND_WINDOW_MONTHS with no sales when demand was adjusted. */
  stockoutMonthsExcluded: number | null;
  /**
   * Pareto class by annual sales value across the recommendation set.
   * A ≈ top cumulative 80%, B ≈ next to 95%, C = remainder. null if unknown.
   */
  abcClass: AbcClass;
  /**
   * Approximate inventory turns per year:
   * annualDemandUnits / quantityOnHand (null when either side is missing/zero).
   */
  turnoverRatio: number | null;
  unitCost: number | null;
  supplierExternalId: string | null;
  vendorItemNumber: string | null;
  leadTimeDays: number | null;
  /** Effective lead time for cover banding (may differ from quote used for ROP). */
  effectiveLeadTimeDays: number | null;
  leadTimeSource: LeadTimeSource;
  effectiveLeadTimeSupplierExternalId: string | null;
  /** Per-item months-of-cover band thresholds (lead-time-relative or standard). */
  coverBands: CoverBands;
  palletQty: number | null;
  containerQty: number | null;
  orderingCostPerOrder: number | null;
  holdingCostPerUnitYear: number | null;
  supplierUnitPrice: number | null;
  supplierName: string | null;
  supplierLeadTimeDays: number | null;
  eoq: number | null;
  safetyStock: number | null;
  rop: number | null;
  suggestedQtyRaw: number;
  suggestedQtyRounded: number;
  roundingUnit: RoundingUnit;
  containerCount: number | null;
  palletCount: number | null;
  status: ReorderStatus;
  dataGaps: string[];
  /**
   * Why suggested qty is 0 or purchasing is blocked. Null when suggested qty
   * is a real positive recommendation (vendor_lock does not set a reason).
   * Precedence when set: blocked_rule > already_covered > no_demand > no_target.
   */
  suggestedQtyZeroReason: SuggestedQtyZeroReason | null;
  /** Auto-detected from monthly sales history; null when no history fetched. */
  seasonality: SeasonalityResult | null;
  /**
   * Units already on platform (dashboard) POs in draft / pending_approval /
   * approved / sent. Distinct from GP quantityOnOrder.
   */
  openPoQty: number;
  /** Open platform PO line refs for this SKU (for chip title + expanded panel). */
  openPoRefs: Array<{
    poId: string;
    poNumber: string;
    status: string;
    quantity: number;
  }>;
  /**
   * Supplier-level inbound containers (not SKU-confirmed). Null when this
   * supplier has nothing on the latest container sheet.
   */
  inbound: {
    containerCount: number;
    etaLabel: string;
    nextEtaPort: string | null;
  } | null;
};

export type SupplierReference = {
  supplierExternalId: string;
  supplierName: string | null;
  unitPrice: number | null;
  leadTimeDays: number | null;
  isPriorityVendor: boolean;
  vendorItemNumber: string | null;
  currency: string;
  reliabilityRating: SupplierReliabilityRating | null;
  supplierRegion: string | null;
  minOrderQty: number | null;
  notes: string | null;
  hasQuoteOnFile?: boolean;
};

export type SuggestedQtyInput = {
  quantityAvailable: number;
  quantityOnOrder: number;
  quantityInPipeline: number;
  rop: number | null;
  reorderLevel: number | null;
  maximumStockLevel: number | null;
  eoq: number | null;
  avgDailyDemandUnits: number | null;
  leadTimeDays: number | null;
  orderingCostPerOrder: number | null;
  holdingCostPerUnitYear: number | null;
  annualDemandUnits: number | null;
};

export type ClassifyReorderStatusInput = {
  quantityAvailable: number;
  quantityOnOrder: number;
  quantityInPipeline: number;
  quantityOnHand: number;
  rop: number | null;
  reorderLevel: number | null;
  suggestedQty: number;
  annualDemandUnits: number | null;
  unitCost: number | null;
};

export type PackSizeInput = {
  suggestedQty: number;
  palletQty: number | null;
  containerQty: number | null;
};

export type PackSizeResult = {
  roundedQty: number;
  roundingUnit: RoundingUnit;
  containerCount?: number;
  palletCount?: number;
};

export type PoLineInput = {
  sku: string;
  productExternalId: string | null;
  name: string | null;
  vendorItemNumber: string | null;
  quantity: number;
  unitCost: number | null;
};

export type PoReviewLine = PoLineInput & {
  lineTotal: number | null;
};

export type PoReviewSupplierGroup = {
  supplierExternalId: string;
  supplierName: string | null;
  supplierEmail: string | null;
  supplierAddress: string | null;
  lines: PoReviewLine[];
};

export type PurchaseOrderLineRecord = {
  id: string;
  external_id: string;
  po_external_id: string;
  po_number: string | null;
  product_external_id: string | null;
  sku: string | null;
  quantity_ordered: number | null;
  unit_cost: number | null;
  line_total: number | null;
};

export type PurchaseOrderRecord = {
  id: string;
  external_id: string;
  po_number: string | null;
  supplier_external_id: string | null;
  po_date: string | null;
  status: string | null;
  total_amount: number | null;
  memo: string | null;
  sent_at: string | null;
  created_by: string | null;
  source_system: string;
  tenant_id: string;
};

export type PurchaseOrderListLineSummary = {
  sku: string;
  productName: string;
  quantity: number;
};

export type PurchaseOrderListItem = {
  id: string;
  poNumber: string;
  supplierName: string | null;
  supplierEmail: string | null;
  poDate: string | null;
  totalAmount: number | null;
  hasUnknownLineCosts: boolean;
  unpricedLineCount: number;
  lineCount: number;
  totalUnits: number;
  lines: PurchaseOrderListLineSummary[];
  status: string;
  sentAt: string | null;
  createdBy: string | null;
};

export type PurchaseOrderLineDocument = {
  sku: string;
  vendorItemNumber: string | null;
  description: string | null;
  quantityOrdered: number;
  unitCost: number | null;
  lineTotal: number | null;
};

export type PurchaseOrderDocument = {
  id: string;
  poNumber: string;
  poDate: string;
  status: string;
  totalAmount: number | null;
  hasUnknownLineCosts: boolean;
  unpricedLineCount: number;
  memo: string | null;
  sentAt: string | null;
  createdBy: string | null;
  supplierExternalId: string | null;
  supplierName: string | null;
  supplierEmail: string | null;
  supplierAddress: string | null;
  lines: PurchaseOrderLineDocument[];
};

export type GeneratePurchaseOrderInput = {
  supplierExternalId: string;
  memo: string | null;
  lines: PoLineInput[];
};

export type PurchaseOrderActionResult = {
  success: boolean;
  error?: string;
  purchaseOrderId?: string;
};

export type PoCartItem = {
  id: string;
  tenantId: string;
  createdBy: string;
  sku: string;
  productName: string | null;
  /** Looked up from products.unit_of_measure when cart is loaded. */
  unitOfMeasure: string | null;
  quantity: number;
  supplierExternalId: string | null;
  unitPrice: number | null;
  currency: string | null;
  sourceStatus: string | null;
  addedAt: string;
  updatedAt: string;
  /** Present when an approver overrode vendor_lock for this line. */
  lockOverrideReason: string | null;
  lockOverriddenBy: string | null;
  lockOverriddenAt: string | null;
  lockOriginalVendor: string | null;
};

export type PoCartGroup = {
  supplierExternalId: string | null;
  supplierName: string | null;
  items: PoCartItem[];
  subtotalUsd: number | null;
};

export type PoCartResponse = {
  groups: PoCartGroup[];
  totalItems: number;
  /** ISR options keyed by SKU (included on GET /api/po-cart). */
  skuSupplierOptions?: Record<
    string,
    Array<{
      supplierExternalId: string;
      supplierName: string | null;
      unitPrice: number | null;
      leadTimeDays: number | null;
      isPriorityVendor: boolean;
      palletQty: number | null;
    }>
  >;
  purchaseRulesBySku?: Record<
    string,
    { ruleType: ItemPurchaseRuleType; lockedVendorId: string | null }
  >;
};

export type VelocityTrend = "accelerating" | "decelerating" | "stable" | "unknown";

export type MismatchSeverity = "high" | "medium" | "low";

export type MismatchFlag = {
  type: string;
  severity: MismatchSeverity;
  message: string;
};

export type VwSalesVelocityRow = {
  tenant_id: string;
  sku: string;
  units_sold_last_30d: number;
  units_sold_31_60d: number;
  units_sold_61_90d: number;
  units_sold_trailing_12m: number;
  avg_monthly_last_3m: number;
  avg_monthly_trailing_12m: number;
  velocity_trend_pct: number | null;
  last_sale_date: string | null;
  days_since_last_sale: number | null;
};

export type DetectMismatchInput = {
  velocityTrend: VelocityTrend;
  daysOfCover: number | null;
  quantityAvailable: number;
  quantityOnOrder: number;
  quantityInPipeline: number;
  leadTimeDays: number | null;
  avgMonthlyLast3m: number;
  unitsSoldLast30d: number;
  unitsSold31To60d: number;
};

export type VelocityDiagnostic = {
  sku: string;
  trend: VelocityTrend;
  daysOfCover: number | null;
  projectedStockoutDate: Date | null;
  mismatchFlags: MismatchFlag[];
  unitsSoldLast30d: number;
  unitsSold31To60d: number;
  unitsSold61To90d: number;
  avgMonthlyLast3m: number;
  avgMonthlyTrailing12m: number;
  velocityTrendPct: number | null;
  daysSinceLastSale: number | null;
  lastSaleDate: string | null;
};
