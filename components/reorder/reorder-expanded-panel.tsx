"use client";

import { Info, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { createDraftPoSelection } from "@/app/(main)/reorder/actions";
import type { ReorderItemExplanationResult } from "@/app/(main)/reorder/ai-actions";
import { SeasonalWarningBadge } from "@/components/reorder/seasonal-warning-badge";
import { AiFormattedText } from "@/components/reorder/ai-formatted-text";
import { formatCurrencyJMD, formatNumber } from "@/lib/format";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import type { PipelineBreakdown } from "@/lib/pipeline-breakdown";
import { formatRoundingInfo } from "@/lib/reorder-engine";
import {
  computeMonthsOfCoverAtOrderQty,
  formatMonthsOfCoverLabel,
  getMonthsOfCoverBadgeClasses,
  getMonthsOfCoverColorTier,
} from "@/lib/reorder/months-of-cover";
import { getSeasonalReorderWarning } from "@/lib/seasonality/reorder-warnings";
import type { ItemSeasonalityProfile } from "@/lib/seasonality/types";
import type {
  ReorderRecommendation,
  SupplierReference,
  SupplierReliabilityRating,
} from "@/lib/types";

type ReorderExpandedPanelProps = {
  rec: ReorderRecommendation;
  pipeline: PipelineBreakdown;
  seasonalityProfile?: ItemSeasonalityProfile | null;
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

function parseOrderQtyInput(value: string): number {
  const trimmed = value.trim();
  if (trimmed === "") {
    return 0;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
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

function isCoverDemandUnknown(rec: ReorderRecommendation): boolean {
  return computeMonthsOfCoverAtOrderQty(rec, 0) === null;
}

function getCoverPillClasses(
  months: number | null,
  demandUnknown: boolean
): string {
  if (demandUnknown) {
    return "border-[#E5E7EB] bg-[#F3F4F6] text-[#9CA3AF]";
  }

  return getMonthsOfCoverBadgeClasses(getMonthsOfCoverColorTier(months));
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

  switch (getMonthsOfCoverColorTier(months)) {
    case "red":
      return "bg-[#FDF2F2] text-[#CC2B2B]";
    case "amber":
      return "bg-[#FFFBEB] text-[#B45309]";
    case "green":
      return "bg-[#F0FDF4] text-[#16A34A]";
    default:
      return "bg-[#F3F4F6] text-[#9CA3AF]";
  }
}

function getStatusBadge(rec: ReorderRecommendation): {
  label: string;
  className: string;
} | null {
  if (
    rec.suggestedQtyRounded === 0 &&
    rec.status !== "critical" &&
    rec.status !== "watch" &&
    rec.status !== "reorder_needed"
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
    case "watch":
      return {
        label: "Watch",
        className:
          "rounded-full border border-[#B8D9F0] bg-[#E6F1FB] px-3 py-1 text-xs font-semibold text-[#185FA5]",
      };
    case "reorder_needed":
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

function formatSupplierUnitPrice(unitPrice: number | null | undefined): string {
  if (!isValidNumber(unitPrice)) {
    return "-";
  }

  return formatCurrencyJMD(unitPrice);
}

function getReliabilityBadgeClasses(
  rating: SupplierReliabilityRating | null
): string {
  switch (rating) {
    case "Preferred":
      return "border-[#86EFAC] bg-[#F0FDF4] text-[#16A34A]";
    case "Approved":
      return "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]";
    case "Conditional":
      return "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]";
    default:
      return "border-[#E5E7EB] bg-[#F3F4F6] text-[#9CA3AF]";
  }
}

function PipelineSegment({
  label,
  value,
  iconClass,
  accent = false,
}: {
  label: string;
  value: number;
  iconClass: string;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "flex-1 px-3.5 py-2.5",
        accent
          ? "bg-[var(--pipeline-effective-bg)]"
          : "border-r border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)]",
      ].join(" ")}
    >
      <div
        className={[
          "mb-1 flex items-center gap-1 text-[10px] tracking-wide",
          accent
            ? "text-[var(--pipeline-effective-label)]"
            : "text-[var(--color-text-secondary)]",
        ].join(" ")}
      >
        <i className={`ti ${iconClass} text-xs`} aria-hidden="true" />
        {label}
      </div>
      <div
        className={[
          "text-base font-medium tabular-nums",
          accent
            ? "text-[var(--pipeline-effective-value)]"
            : "text-[var(--color-text-primary)]",
        ].join(" ")}
      >
        {formatNumber(value)}
      </div>
    </div>
  );
}

function PipelineStockSection({
  rec,
  pipeline,
}: {
  rec: ReorderRecommendation;
  pipeline: PipelineBreakdown;
}) {
  return (
    <div className="mb-5">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
        Pipeline stock
      </h4>
      <div className="flex items-stretch overflow-hidden rounded-[var(--border-radius-md)] border border-[var(--color-border-tertiary)]">
        <PipelineSegment
          label="In transit"
          value={pipeline.inTransit}
          iconClass="ti-ship"
        />
        <PipelineSegment
          label="In bond"
          value={pipeline.inBond}
          iconClass="ti-lock"
        />
        <PipelineSegment
          label="At port"
          value={pipeline.atPort}
          iconClass="ti-anchor"
        />
        <PipelineSegment
          label="In clearing"
          value={pipeline.inClearing}
          iconClass="ti-file-text"
        />
        <PipelineSegment
          label="Effective available"
          value={rec.effectiveAvailable}
          iconClass="ti-stack"
          accent
        />
      </div>
    </div>
  );
}

function AnalysisSection({
  explanation,
  isLoadingExplanation,
  dataGaps,
}: {
  explanation: ReorderItemExplanationResult | null;
  isLoadingExplanation: boolean;
  dataGaps: string[];
}) {
  return (
    <div className="mb-5 rounded-lg bg-white p-5 ring-1 ring-slate-200">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-tbc-red" aria-hidden="true" />
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
  );
}

function InventoryDetailsSection({
  rec,
  lineTotal,
}: {
  rec: ReorderRecommendation;
  lineTotal: number | null;
}) {
  const roundingInfo = formatRoundingInfo(rec);
  const showQtyOnOrder = rec.quantityOnOrder > 0;
  const showQtyInPipeline = rec.quantityInPipeline > 0;
  const showMaxStockLevel =
    rec.maximumStockLevel !== null && rec.maximumStockLevel !== 0;
  const showRounding = roundingInfo !== "-";
  const showLineTotal = lineTotal !== null && lineTotal !== 0;

  return (
    <div className="mt-5">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
        Inventory Details
      </h4>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-[#F3F4F6] pt-5 lg:grid-cols-4">
        <InventoryDetailItem
          label="Qty Available (GP)"
          iconClass="ti-package"
          value={formatInventoryNumber(rec.quantityAvailable)}
        />
        {showQtyOnOrder ? (
          <InventoryDetailItem
            label="Qty On Order"
            iconClass="ti-shopping-cart"
            value={formatInventoryNumber(rec.quantityOnOrder)}
          />
        ) : null}
        {showQtyInPipeline ? (
          <InventoryDetailItem
            label="Qty In Pipeline"
            iconClass="ti-arrow-down-circle"
            value={formatInventoryNumber(rec.quantityInPipeline)}
          />
        ) : null}
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
        {showMaxStockLevel ? (
          <InventoryDetailItem
            label="Max Stock Level"
            iconClass="ti-box"
            value={formatInventoryNullableNumber(rec.maximumStockLevel)}
          />
        ) : null}
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
        {showRounding ? (
          <InventoryDetailItem
            label="Rounding"
            iconClass="ti-adjustments"
            value={formatInventoryTextValue(roundingInfo)}
          />
        ) : null}
        <InventoryDetailItem
          label="Unit Cost"
          iconClass="ti-currency-dollar"
          value={formatUnitCostValue(rec.unitCost)}
        />
        {showLineTotal ? (
          <InventoryDetailItem
            label="Line Total"
            iconClass="ti-receipt"
            value={formatLineTotalValue(lineTotal)}
          />
        ) : null}
      </dl>
    </div>
  );
}

export function ReorderExpandedPanel({
  rec,
  pipeline,
  seasonalityProfile = null,
  explanation,
  isLoadingExplanation,
}: ReorderExpandedPanelProps) {
  const lineTotal =
    rec.unitCost !== null && rec.unitCost !== undefined
      ? rec.suggestedQtyRounded * rec.unitCost
      : null;
  const dataGaps = explanation?.dataGaps ?? rec.dataGaps;

  const [orderQtyInput, setOrderQtyInput] = useState(
    String(rec.suggestedQtyRounded)
  );
  const parsedOrderQty = useMemo(
    () => parseOrderQtyInput(orderQtyInput),
    [orderQtyInput]
  );
  const debouncedOrderQty = useDebouncedValue(parsedOrderQty, 300);
  const [selectedSupplierExternalId, setSelectedSupplierExternalId] = useState<
    string | null
  >(rec.supplierExternalId);
  const [selectedSupplierPrice, setSelectedSupplierPrice] = useState<
    number | null
  >(rec.supplierUnitPrice);
  const [suppliers, setSuppliers] = useState<SupplierReference[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [addToPoError, setAddToPoError] = useState<string | null>(null);
  const [isAddingToPo, startAddToPoTransition] = useTransition();

  useEffect(() => {
    setOrderQtyInput(String(rec.suggestedQtyRounded));
    setSelectedSupplierExternalId(rec.supplierExternalId);
    setSelectedSupplierPrice(rec.supplierUnitPrice);
    setAddToPoError(null);
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

  const debouncedMonthsOfCover = useMemo(
    () => computeMonthsOfCoverAtOrderQty(rec, debouncedOrderQty),
    [rec, debouncedOrderQty]
  );
  const totalCostUsd = useMemo(() => {
    if (!isValidNumber(selectedSupplierPrice) || debouncedOrderQty <= 0) {
      return "-";
    }

    return formatUsdAmount(selectedSupplierPrice * debouncedOrderQty);
  }, [selectedSupplierPrice, debouncedOrderQty]);
  const simulatorArrival = formatEstArrivalDate(rec.leadTimeDays, debouncedOrderQty > 0);
  const suggestedMonthsOfCover = computeMonthsOfCoverAtOrderQty(
    rec,
    rec.suggestedQtyRounded
  );
  const coverDemandUnknown = isCoverDemandUnknown(rec);
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

  function handleSelectSupplier(supplier: SupplierReference) {
    setSelectedSupplierExternalId(supplier.supplierExternalId);
    setSelectedSupplierPrice(supplier.unitPrice);
  }

  function handleAddToPo() {
    setAddToPoError(null);

    startAddToPoTransition(async () => {
      const result = await createDraftPoSelection([
        {
          sku: rec.sku,
          supplierExternalId: selectedSupplierExternalId,
          suggestedQty: parseOrderQtyInput(orderQtyInput),
        },
      ]);

      if (!result.success) {
        setAddToPoError(result.error ?? "Failed to add item to PO");
      }
    });
  }

  return (
    <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-4 py-4">
      {getSeasonalReorderWarning(seasonalityProfile) ? (
        <div className="mb-4">
          <SeasonalWarningBadge profile={seasonalityProfile} />
        </div>
      ) : null}

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
              value={orderQtyInput}
              onChange={(event) => setOrderQtyInput(event.target.value)}
              aria-label="Simulated order quantity"
              className="w-28 rounded-xl border-2 border-[#E5E7EB] px-3 py-2 text-center text-3xl font-bold text-[#111111] transition-all duration-150 focus:border-[#CC2B2B] focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/10"
            />
            <button
              type="button"
              onClick={() => setOrderQtyInput(String(rec.suggestedQtyRounded))}
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
                  debouncedMonthsOfCover,
                  coverDemandUnknown
                )}`}
              >
                {coverDemandUnknown || debouncedMonthsOfCover === null
                  ? "Unknown"
                  : formatMonthsOfCoverLabel(debouncedMonthsOfCover)}
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

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={isAddingToPo}
              onClick={handleAddToPo}
              className="rounded-xl bg-tbc-red px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-tbc-red-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAddingToPo ? "Adding..." : "Add to PO"}
            </button>
          </div>

          {addToPoError ? (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {addToPoError}
            </p>
          ) : null}
        </div>
      </div>

      <AnalysisSection
        explanation={explanation}
        isLoadingExplanation={isLoadingExplanation}
        dataGaps={dataGaps}
      />

      {!suppliersLoading && suppliers.length > 0 ? (
        <div className="mb-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
                Available Suppliers
              </h4>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                Reference data quotes for this SKU only
              </p>
            </div>
            <span className="text-xs text-[#9CA3AF]">
              {formatNumber(suppliers.length)} supplier
              {suppliers.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
            <div className="max-h-[17.5rem] overflow-y-auto">
              <div className="min-w-[56rem]">
                <div className="sticky top-0 z-10 grid grid-cols-[minmax(10rem,1.2fr)_6rem_7rem_8rem_7rem_6rem_5.5rem] border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
                  <span>Supplier Name</span>
                  <span className="text-right">Lead Time</span>
                  <span className="text-right">Unit Price (J$)</span>
                  <span>Reliability</span>
                  <span>Region</span>
                  <span className="text-right">Min Order</span>
                  <span className="text-right"> </span>
                </div>
                {suppliers.map((supplier) => {
                  const isSelected =
                    selectedSupplierExternalId === supplier.supplierExternalId;

                  return (
                    <div
                      key={supplier.supplierExternalId}
                      className={[
                        "grid grid-cols-[minmax(10rem,1.2fr)_6rem_7rem_8rem_7rem_6rem_5.5rem] items-center border-t border-[#F3F4F6] px-4 py-3 text-sm transition-colors hover:bg-[#F9FAFB]",
                        isSelected ? "bg-[#EFF6FF]/60" : "bg-white",
                      ].join(" ")}
                    >
                      <div>
                        <p className="font-medium text-[#111111]">
                          {supplier.supplierName ?? supplier.supplierExternalId}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-[#9CA3AF]">
                          {supplier.supplierExternalId}
                        </p>
                      </div>
                      <div className="text-right text-[#111111]">
                        {isValidNumber(supplier.leadTimeDays) ? (
                          `${formatNumber(supplier.leadTimeDays)}d`
                        ) : (
                          <span className="text-[#9CA3AF]">-</span>
                        )}
                      </div>
                      <div className="text-right font-medium text-[#111111]">
                        {formatSupplierUnitPrice(supplier.unitPrice)}
                      </div>
                      <div>
                        {supplier.reliabilityRating ? (
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getReliabilityBadgeClasses(
                              supplier.reliabilityRating
                            )}`}
                          >
                            {supplier.reliabilityRating}
                          </span>
                        ) : (
                          <span className="text-[#9CA3AF]">-</span>
                        )}
                      </div>
                      <div className="text-[#111111]">
                        {supplier.supplierRegion ? (
                          supplier.supplierRegion
                        ) : (
                          <span className="text-[#9CA3AF]">-</span>
                        )}
                      </div>
                      <div className="text-right text-[#111111]">
                        {isValidNumber(supplier.minOrderQty) ? (
                          formatNumber(supplier.minOrderQty)
                        ) : (
                          <span className="text-[#9CA3AF]">-</span>
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
            </div>
          </div>
        </div>
      ) : null}

      {suppliersLoading ? (
        <div className="mb-5 space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`supplier-skeleton-${index}`}
              className="h-10 w-full animate-pulse rounded bg-[#F3F4F6]"
            />
          ))}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="mb-5 rounded-xl border border-dashed border-[#E5E7EB] bg-[#F9FAFB] p-6 text-center">
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
      ) : null}

      <PipelineStockSection rec={rec} pipeline={pipeline} />

      <InventoryDetailsSection rec={rec} lineTotal={lineTotal} />
    </div>
  );
}
