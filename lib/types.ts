export type ItemSupplierReference = {
  id: string;
  tenant_id: string;
  sku: string;
  supplier_external_id: string;
  vendor_item_number: string | null;
  lead_time_days: number | null;
  pallet_qty: number | null;
  container_qty: number | null;
  is_priority_vendor: boolean;
  ordering_cost_per_order: number | null;
  holding_cost_per_unit_year: number | null;
  unit_price: number | null;
  currency: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ItemSupplierReferenceInput = {
  sku: string;
  supplier_external_id: string;
  vendor_item_number: string | null;
  lead_time_days: number | null;
  pallet_qty: number | null;
  container_qty: number | null;
  is_priority_vendor: boolean;
  ordering_cost_per_order: number | null;
  holding_cost_per_unit_year: number | null;
  unit_price: number | null;
  currency: string;
  notes: string | null;
};

export type ItemSupplierReferenceRow = ItemSupplierReference & {
  product_name: string | null;
  supplier_name: string | null;
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
  "pallet_qty",
  "container_qty",
  "ordering_cost_per_order",
  "holding_cost_per_unit_year",
  "unit_price",
] as const;

export type NumericReferenceField = (typeof NUMERIC_REFERENCE_FIELDS)[number];

export type ReorderStatus = "critical" | "reorder" | "ok" | "inactive";

export type RoundingUnit = "container" | "pallet" | "unit";

export type VwReorderInputsRow = {
  tenant_id: string;
  sku: string;
  name: string | null;
  item_class: string | null;
  category: string | null;
  quantity_on_hand: number | null;
  quantity_available: number | null;
  quantity_on_order: number | null;
  quantity_in_transit: number | null;
  quantity_in_bond: number | null;
  quantity_at_port: number | null;
  quantity_in_clearing: number | null;
  reorder_level: number | null;
  maximum_stock_level: number | null;
  annual_demand_units: number | null;
  avg_daily_demand_units: number | null;
  ordering_cost_per_order: number | null;
  holding_cost_per_unit_year: number | null;
  current_cost_local: number | null;
  best_supplier_external_id: string | null;
  best_unit_price: number | null;
  lead_time_days: number | null;
  pallet_qty: number | null;
  container_qty: number | null;
};

export type ReorderRecommendation = {
  tenantId: string;
  sku: string;
  name: string | null;
  itemClass: string | null;
  category: string | null;
  isActive: boolean | null;
  quantityOnHand: number;
  quantityAvailable: number;
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
  unitCost: number | null;
  supplierExternalId: string | null;
  vendorItemNumber: string | null;
  leadTimeDays: number | null;
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
};

export type SupplierReference = {
  supplierExternalId: string;
  unitPrice: number | null;
  leadTimeDays: number | null;
  isPriorityVendor: boolean;
  vendorItemNumber: string | null;
  currency: string;
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
  source_system: string;
  tenant_id: string;
};

export type PurchaseOrderListItem = {
  id: string;
  poNumber: string;
  supplierName: string | null;
  supplierEmail: string | null;
  poDate: string | null;
  totalAmount: number | null;
  status: string;
  sentAt: string | null;
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
  memo: string | null;
  sentAt: string | null;
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
