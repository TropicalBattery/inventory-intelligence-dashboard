"use client";

import { Info, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ReorderItemExplanationResult } from "@/app/(main)/reorder/ai-actions";
import { AiFormattedText } from "@/components/reorder/ai-formatted-text";
import { formatCurrencyJMD, formatNumber } from "@/lib/format";
import type { PipelineBreakdown } from "@/lib/pipeline-breakdown";
import { formatRoundingInfo } from "@/lib/reorder-engine";
import type { ReorderRecommendation, SupplierReference } from "@/lib/types";

type ReorderExpandedPanelProps = {
  rec: ReorderRecommendation;
  pipeline: PipelineBreakdown;
  explanation: ReorderItemExplanationResult | null;
  isLoadingExplanation: boolean;
};

function AnalysisSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
      <div className="h-3 w-11/12 animate-pulse rounded bg-slate-200" />
      <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200" />
    </div>
  );
}

function isValidNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function formatUsdAmount(value: number | null | undefined): string {
  if (!isValidNumber(value)) {
    return "-";
  }

  return `US$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatLeadTimeDays(value: number | null | undefined): string {
  if (!isValidNumber(value)) {
    return "-";
  }

  return `${formatNumber(value)} days`;
}

function formatEstArrivalDate(
  leadTimeDays: number | null | undefined,
  showDate: boolean
): string {
  if (!showDate || !isValidNumber(leadTimeDays) || leadTimeDays <= 0) {
    return "-";
  }

  return new Date(Date.now() + leadTimeDays * 86400000).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

function computeMonthsOfCover(
  rec: ReorderRecommendation,
  orderQty: number
): number | null {
  if (
    !isValidNumber(rec.avgDailyDemandUnits) ||
    rec.avgDailyDemandUnits <= 0 ||
    orderQty < 0
  ) {
    return null;
  }

  const months =
    (rec.quantityAvailable + rec.quantityOnOrder + orderQty) /
    (rec.avgDailyDemandUnits * 30.44);

  return Number.isFinite(months) ? months : null;
}

function isCoverDemandUnknown(rec: ReorderRecommendation): boolean {
  return (
    !isValidNumber(rec.avgDailyDemandUnits) || rec.avgDailyDemandUnits <= 0
  );
}

function getCoverPillClasses(
  months: number | null,
  demandUnknown: boolean
): string {
  if (demandUnknown) {
    return "border-[#E5E7EB] bg-[#F3F4F6] text-[#9CA3AF]";
  }

  if (months === null || months < 1) {
    return "border-[#FCA5A5] bg-[#FDF2F2] text-[#CC2B2B]";
  }

  if (months >= 3) {
    return "border-[#86EFAC] bg-[#F0FDF4] text-[#16A34A]";
  }

  return "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]";
}

function getCoverPillLabel(
  months: number | null,
  demandUnknown: boolean
): string {
  if (demandUnknown || months === null) {
    return "Cover unknown";
  }

  return `${months.toFixed(1)} months cover`;
}

function getCoverBadgeClasses(
  months: number | null,
  demandUnknown: boolean
): string {
  if (demandUnknown || months === null) {
    return "bg-[#F3F4F6] text-[#9CA3AF]";
  }

  if (months < 1) {
    return "bg-[#FDF2F2] text-[#CC2B2B]";
  }

  if (months >= 3) {
    return "bg-[#F0FDF4] text-[#16A34A]";
  }

  return "bg-[#FFFBEB] text-[#B45309]";
}

function getStatusBadge(rec: ReorderRecommendation): {
  label: string;
  className: string;
} | null {
  if (
    rec.suggestedQtyRounded === 0 &&
    rec.status !== "critical" &&
    rec.status !== "reorder"
  ) {
    return {
      label: "No Suggestion",
      className:
        "rounded-full border border-[#E5E7EB] bg-[#F3F4F6] px-3 py-1 text-xs font-semibold text-[#6B7280]",
    };
  }

  switch (rec.status) {
    case "critical":
      return {
        label: "Critical",
        className:
          "rounded-full border border-[#FCA5A5] bg-[#FDF2F2] px-3 py-1 text-xs font-semibold text-[#CC2B2B]",
      };
    case "reorder":
      return {
        label: "Reorder Needed",
        className:
          "rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-3 py-1 text-xs font-semibold text-[#B45309]",
      };
    case "ok":
      return {
        label: "OK",
        className:
          "rounded-full border border-[#86EFAC] bg-[#F0FDF4] px-3 py-1 text-xs font-semibold text-[#16A34A]",
      };
    default:
      return null;
  }
}

function getRoundingSubLabel(rec: ReorderRecommendation): string | null {
  if (!rec.roundingUnit) {
    return null;
  }

  return `Rounded to nearest ${rec.roundingUnit}`;
}

function formatArrivalPillLabel(
  leadTimeDays: number | null | undefined
): string | null {
  if (!isValidNumber(leadTimeDays) || leadTimeDays <= 0) {
    return null;
  }

  const date = new Date(Date.now() + leadTimeDays * 86400000).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );

  return `Arrives ${date}`;
}

function InventoryDetailItem({
  label,
  iconClass,
  value,
}: {
  label: string;
  iconClass: string;
  value: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">
        <i className={`ti ${iconClass} text-xs`} aria-hidden="true" />
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatInventoryNumber(value: number): ReactNode {
  if (value === 0) {
    return (
      <span className="text-sm font-medium text-[#9CA3AF]">
        {formatNumber(value)}
      </span>
    );
  }

  return (
    <span className="text-sm font-semibold text-[#111111]">
      {formatNumber(value)}
    </span>
  );
}

function formatInventoryNullableNumber(value: number | null): ReactNode {
  if (value === null) {
    return <span className="text-sm text-[#9CA3AF]">-</span>;
  }

  return formatInventoryNumber(value);
}

function formatInventoryTextValue(value: string): ReactNode {
  if (value === "-") {
    return <span className="text-sm text-[#9CA3AF]">-</span>;
  }

  return (
    <span className="text-sm font-semibold text-[#111111]">{value}</span>
  );
}

function formatUnitCostValue(unitCost: number | null): ReactNode {
  if (unitCost === null) {
    return <span className="text-sm text-[#9CA3AF]">-</span>;
  }

  if (unitCost > 0) {
    return (
      <span className="text-sm font-semibold text-[#111111]">
        {formatCurrencyJMD(unitCost)}
      </span>
    );
  }

  return (
    <span className="text-sm font-medium text-[#9CA3AF]">
      {formatCurrencyJMD(unitCost)}
    </span>
  );
}

function formatLineTotalValue(lineTotal: number | null): ReactNode {
  if (lineTotal === null || lineTotal === 0) {
    return <span className="text-sm text-[#9CA3AF]">-</span>;
  }

  return (
    <span className="text-sm font-semibold text-[#111111]">
      {formatCurrencyJMD(lineTotal)}
    </span>
  );
}

function formatMonthsOfCoverValue(months: number | null): ReactNode {
  if (months === null) {
    return <span className="text-sm text-[#9CA3AF]">-</span>;
  }

  return (
    <span className="text-sm font-semibold text-[#111111]">
      {months.toFixed(1)}
    </span>
  );
}

function ItemClassCategoryValue({
  itemClass,
  category,
}: {
  itemClass: string | null;
  category: string | null;
}) {
  if (!itemClass || !category) {
    return <span className="text-sm text-[#9CA3AF]">-</span>;
  }

  return (
    <div className="flex flex-wrap items-center">
      <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 font-mono text-xs text-[#374151]">
        {itemClass}
      </span>
      <span className="mx-1 text-[#9CA3AF]">/</span>
      <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 text-xs text-[#374151]">
        {category}
      </span>
    </div>
  );
}

function PipelineBreakdownGrid({ pipeline }: { pipeline: PipelineBreakdown }) {
  const allZero =
    pipeline.inTransit === 0 &&
    pipeline.inBond === 0 &&
    pipeline.atPort === 0 &&
    pipeline.inClearing === 0;

  if (allZero) {
    return (
      <p className="mt-1 text-xs text-[#9CA3AF]">No stock in pipeline</p>
    );
  }

  const cells = [
    { label: "In transit", value: pipeline.inTransit },
    { label: "In bond", value: pipeline.inBond },
    { label: "At port", value: pipeline.atPort },
    { label: "In clearing", value: pipeline.inClearing },
  ];

  return (
    <div className="mt-1 grid grid-cols-2 gap-1">
      {cells.map((cell) => (
        <p key={cell.label} className="text-xs text-[#6B7280]">
          {cell.label}: {formatNumber(cell.value)}
        </p>
      ))}
    </div>
  );
}

export function ReorderExpandedPanel({
  rec,
  pipeline,
  explanation,
  isLoadingExplanation,
}: ReorderExpandedPanelProps) {
  const lineTotal =
    rec.unitCost !== null && rec.unitCost !== undefined
      ? rec.suggestedQtyRounded * rec.unitCost
      : null;
  const dataGaps = explanation?.dataGaps ?? rec.dataGaps;

  const [simQty, setSimQty] = useState(rec.suggestedQtyRounded);
  const [selectedSupplierExternalId, setSelectedSupplierExternalId] = useState<
    string | null
  >(rec.supplierExternalId);
  const [selectedSupplierPrice, setSelectedSupplierPrice] = useState<
    number | null
  >(rec.supplierUnitPrice);
  const [suppliers, setSuppliers] = useState<SupplierReference[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);

  useEffect(() => {
    setSimQty(rec.suggestedQtyRounded);
    setSelectedSupplierExternalId(rec.supplierExternalId);
    setSelectedSupplierPrice(rec.supplierUnitPrice);
  }, [rec.sku, rec.suggestedQtyRounded, rec.supplierExternalId, rec.supplierUnitPrice]);

  useEffect(() => {
    setSuppliersLoading(true);
    fetch(`/api/suppliers-by-sku?sku=${encodeURIComponent(rec.sku)}`)
      .then((response) => response.json())
      .then((data: { suppliers?: SupplierReference[] }) => {
        setSuppliers(data.suppliers ?? []);
      })
      .catch(() => setSuppliers([]))
      .finally(() => setSuppliersLoading(false));
  }, [rec.sku]);

  const totalCostUsd = useMemo(() => {
    if (!isValidNumber(selectedSupplierPrice) || simQty <= 0) {
      return "-";
    }

    return formatUsdAmount(selectedSupplierPrice * simQty);
  }, [selectedSupplierPrice, simQty]);

  const simulatorArrival = formatEstArrivalDate(rec.leadTimeDays, simQty > 0);
  const suggestedMonthsOfCover = computeMonthsOfCover(rec, rec.suggestedQtyRounded);
  const simulatedMonthsOfCover = computeMonthsOfCover(rec, simQty);
  const coverDemandUnknown = isCoverDemandUnknown(rec);
  const roundingSubLabel = getRoundingSubLabel(rec);
  const suggestedArrivalLabel = formatArrivalPillLabel(rec.leadTimeDays);
  const statusBadge = getStatusBadge(rec);
  const suggestedTotalCost = useMemo(() => {
    if (
      !isValidNumber(rec.supplierUnitPrice) ||
      rec.suggestedQtyRounded === 0
    ) {
      return null;
    }

    return rec.supplierUnitPrice * rec.suggestedQtyRounded;
  }, [rec.supplierUnitPrice, rec.suggestedQtyRounded]);

  const lowestSupplierPrice = useMemo(() => {
    const prices = suppliers
      .map((supplier) => supplier.unitPrice)
      .filter(isValidNumber);

    if (prices.length === 0) {
      return null;
    }

    return Math.min(...prices);
  }, [suppliers]);

  function handleSelectSupplier(supplier: SupplierReference) {
    setSelectedSupplierExternalId(supplier.supplierExternalId);
    setSelectedSupplierPrice(supplier.unitPrice);
  }

  return (
    <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-4 py-4">
      <div className="mb-5 grid grid-cols-2 gap-8 divide-x divide-[#E5E7EB] rounded-2xl border border-[#E5E7EB] bg-white p-6">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
            Suggested Order
          </p>
          <div className="mb-4 flex items-center gap-3">
            <p className="text-5xl font-bold text-[#111111]">
              {formatNumber(rec.suggestedQtyRounded)}
            </p>
            {statusBadge ? (
              <span className={statusBadge.className}>{statusBadge.label}</span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${getCoverPillClasses(
                suggestedMonthsOfCover,
                coverDemandUnknown
              )}`}
            >
              {getCoverPillLabel(suggestedMonthsOfCover, coverDemandUnknown)}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                isValidNumber(suggestedTotalCost)
                  ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]"
                  : "border-[#E5E7EB] bg-[#F3F4F6] text-[#9CA3AF]"
              }`}
            >
              {isValidNumber(suggestedTotalCost)
                ? formatUsdAmount(suggestedTotalCost)
                : "Cost unknown"}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                suggestedArrivalLabel
                  ? "border-[#DDD6FE] bg-[#F5F3FF] text-[#6D28D9]"
                  : "border-[#E5E7EB] bg-[#F3F4F6] text-[#9CA3AF]"
              }`}
            >
              {suggestedArrivalLabel ?? "Lead time unknown"}
            </span>
          </div>

          {roundingSubLabel ? (
            <p className="mt-3 text-xs text-[#9CA3AF]">{roundingSubLabel}</p>
          ) : null}
        </div>

        <div className="pl-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
            Simulate Order Qty
          </p>
          <div className="mb-5 flex items-center gap-3">
            <input
              type="number"
              min={0}
              step={1}
              value={simQty}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                setSimQty(
                  Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0
                );
              }}
              className="w-28 rounded-xl border-2 border-[#E5E7EB] px-3 py-2 text-center text-3xl font-bold text-[#111111] transition-all duration-150 focus:border-[#CC2B2B] focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/10"
            />
            <button
              type="button"
              onClick={() => setSimQty(rec.suggestedQtyRounded)}
              className="cursor-pointer text-xs text-[#9CA3AF] underline underline-offset-2 hover:text-[#6B7280]"
            >
              Reset
            </button>
          </div>

          <div className="divide-y divide-[#F3F4F6]">
            <div className="flex items-center justify-between py-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
                Months of cover
              </span>
              <span
                className={`rounded-lg px-2.5 py-0.5 text-xs font-semibold ${getCoverBadgeClasses(
                  simulatedMonthsOfCover,
                  coverDemandUnknown
                )}`}
              >
                {coverDemandUnknown || simulatedMonthsOfCover === null
                  ? "Unknown"
                  : `${simulatedMonthsOfCover.toFixed(1)} months`}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
                Total cost
              </span>
              <span
                className={`text-sm font-semibold ${
                  totalCostUsd === "-"
                    ? "text-[#9CA3AF]"
                    : "text-[#1D4ED8]"
                }`}
              >
                {totalCostUsd}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
                Est. arrival
              </span>
              <span
                className={`text-sm font-semibold ${
                  simulatorArrival === "-"
                    ? "text-[#9CA3AF]"
                    : "text-[#111111]"
                }`}
              >
                {simulatorArrival}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
            Available Suppliers
          </h4>
          {suppliers.length > 0 ? (
            <span className="text-xs text-[#9CA3AF]">
              {formatNumber(suppliers.length)} supplier
              {suppliers.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {suppliersLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`supplier-skeleton-${index}`}
                className="h-8 w-full animate-pulse rounded bg-[#F3F4F6]"
              />
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F9FAFB] p-6 text-center">
            <p className="mb-1 text-sm text-[#6B7280]">
              No supplier pricing on file for this SKU.
            </p>
            <Link
              href="/reference-data"
              className="text-xs text-[#CC2B2B] hover:underline"
            >
              Add pricing via Reference Data
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
            <div className="grid grid-cols-[minmax(10rem,1.4fr)_9rem_8rem_7rem_10rem_7rem] border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
              <span>Supplier</span>
              <span>Vendor Item</span>
              <span className="text-right">Unit Price</span>
              <span className="text-right">Lead Time</span>
              <span className="text-right">Est. Arrival</span>
              <span className="text-right"> </span>
            </div>
            {suppliers.map((supplier) => {
              const isSelected =
                selectedSupplierExternalId === supplier.supplierExternalId;
              const isBestPrice =
                isValidNumber(supplier.unitPrice) &&
                isValidNumber(lowestSupplierPrice) &&
                supplier.unitPrice === lowestSupplierPrice;

              return (
                <div
                  key={supplier.supplierExternalId}
                  className={[
                    "grid grid-cols-[minmax(10rem,1.4fr)_9rem_8rem_7rem_10rem_7rem] items-center border-t border-[#F3F4F6] px-4 py-3 text-sm transition-colors hover:bg-[#F9FAFB]",
                    supplier.isPriorityVendor
                      ? "border-l-2 border-l-[#16A34A] bg-[#F0FDF4]/50"
                      : "",
                    isSelected ? "bg-[#EFF6FF]/60" : "bg-white",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div>
                    <span className="font-mono text-xs font-medium text-[#111111]">
                      {supplier.supplierExternalId}
                    </span>
                    {supplier.isPriorityVendor ? (
                      <span className="ml-2 rounded-full bg-[#F0FDF4] px-2 py-0.5 font-sans text-xs text-[#16A34A]">
                        Preferred
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[#111111]">
                    {supplier.vendorItemNumber ? (
                      supplier.vendorItemNumber
                    ) : (
                      <span className="text-[#9CA3AF]">-</span>
                    )}
                  </div>
                  <div className="text-right">
                    {isValidNumber(supplier.unitPrice) ? (
                      <span className="inline-flex items-center justify-end font-medium text-[#111111]">
                        {formatUsdAmount(supplier.unitPrice)}
                        {isBestPrice ? (
                          <span className="ml-1 rounded-full bg-[#FFFBEB] px-2 py-0.5 text-xs text-[#B45309]">
                            Best Price
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-[#9CA3AF]">-</span>
                    )}
                  </div>
                  <div className="text-right text-[#111111]">
                    {isValidNumber(supplier.leadTimeDays) ? (
                      formatLeadTimeDays(supplier.leadTimeDays)
                    ) : (
                      <span className="text-[#9CA3AF]">-</span>
                    )}
                  </div>
                  <div className="text-right text-xs text-[#6B7280]">
                    {formatEstArrivalDate(supplier.leadTimeDays, true) === "-" ? (
                      <span className="text-[#9CA3AF]">-</span>
                    ) : (
                      formatEstArrivalDate(supplier.leadTimeDays, true)
                    )}
                  </div>
                  <div className="text-right">
                    {isSelected ? (
                      <span className="inline-flex cursor-default rounded-full border border-[#86EFAC] bg-[#F0FDF4] px-3 py-1 text-xs font-medium text-[#16A34A]">
                        Selected
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectSupplier(supplier)}
                        className="cursor-pointer rounded-full border border-[#E5E7EB] px-3 py-1 text-xs text-[#6B7280] transition-colors duration-150 hover:border-[#CC2B2B] hover:text-[#CC2B2B]"
                      >
                        Select
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
          Inventory Details
        </h4>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-[#F3F4F6] pt-5 lg:grid-cols-4">
          <InventoryDetailItem
            label="Qty On Order"
            iconClass="ti-shopping-cart"
            value={formatInventoryNumber(rec.quantityOnOrder)}
          />
          <InventoryDetailItem
            label="Qty In Pipeline"
            iconClass="ti-arrow-down-circle"
            value={
              <div>
                {formatInventoryNumber(rec.quantityInPipeline)}
                <PipelineBreakdownGrid pipeline={pipeline} />
              </div>
            }
          />
          <InventoryDetailItem
            label="ROP"
            iconClass="ti-alert-triangle"
            value={formatInventoryNullableNumber(rec.rop)}
          />
          <InventoryDetailItem
            label="Reorder Level"
            iconClass="ti-calendar"
            value={formatInventoryNullableNumber(rec.reorderLevel)}
          />
          <InventoryDetailItem
            label="Max Stock Level"
            iconClass="ti-box"
            value={formatInventoryNullableNumber(rec.maximumStockLevel)}
          />
          <InventoryDetailItem
            label="Item Class / Category"
            iconClass="ti-tag"
            value={
              <ItemClassCategoryValue
                itemClass={rec.itemClass}
                category={rec.category}
              />
            }
          />
          <InventoryDetailItem
            label="Rounding"
            iconClass="ti-adjustments"
            value={formatInventoryTextValue(formatRoundingInfo(rec))}
          />
          <InventoryDetailItem
            label="Unit Cost"
            iconClass="ti-currency-dollar"
            value={formatUnitCostValue(rec.unitCost)}
          />
          <InventoryDetailItem
            label="Line Total"
            iconClass="ti-receipt"
            value={formatLineTotalValue(lineTotal)}
          />
          <InventoryDetailItem
            label="Months of Cover"
            iconClass="ti-clock"
            value={formatMonthsOfCoverValue(suggestedMonthsOfCover)}
          />
        </dl>
      </div>

      <div className="mt-4 rounded-lg bg-white p-5 ring-1 ring-slate-200">
        <div className="flex items-center gap-2">
          <Sparkles
            className="h-4 w-4 text-tbc-red"
            aria-hidden="true"
          />
          <h4 className="text-sm font-semibold text-slate-900">Analysis</h4>
        </div>

        <div className="mt-4">
          {isLoadingExplanation ? (
            <AnalysisSkeleton />
          ) : explanation ? (
            <AiFormattedText text={explanation.explanation} />
          ) : null}
        </div>

        {dataGaps.length > 0 ? (
          <ul className="mt-3 space-y-1.5 border-t border-slate-200 pt-3">
            {dataGaps.map((gap) => (
              <li
                key={gap}
                className="flex items-start gap-2 text-xs text-slate-500"
              >
                <Info
                  className="mt-0.5 h-3 w-3 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
