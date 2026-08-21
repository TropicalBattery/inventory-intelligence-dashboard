"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { ReorderItemExplanationResult } from "@/app/(main)/reorder/ai-actions";
import { CoverBadge } from "@/components/reorder/months-of-cover-display";
import { ReorderExpandedPanel } from "@/components/reorder/reorder-expanded-panel";
import { UomCell } from "@/components/shared/uom-cell";
import { Badge } from "@/components/ui/Badge";
import { formatNumber, formatSuggestedQty } from "@/lib/format";
import { parseUom } from "@/lib/format/uom";
import { resolveSupplierDisplayName } from "@/lib/queries/suppliers";
import {
  getDoNotBuyBadgeMeta,
  isPurchaseBlockedRule,
} from "@/lib/reorder/purchase-rules-ui";
import {
  getStatusBadgeVariant,
  getStatusLabel,
} from "@/lib/reorder-status-ui";
import type { ItemSeasonalityProfile } from "@/lib/seasonality/types";
import type { AbcClass, ReorderRecommendation, ReorderStatus } from "@/lib/types";

export type AvgMovementWindow = 6 | 12;

type ReorderCardListProps = {
  rows: ReorderRecommendation[];
  avgMovementWindow: AvgMovementWindow;
  selectedKeys: Set<string>;
  expandedSkus: Set<string>;
  seasonalityBySku: Record<string, ItemSeasonalityProfile | null | undefined>;
  explanationCache: Map<string, ReorderItemExplanationResult>;
  explanationLoading: Set<string>;
  rowKey: (rec: ReorderRecommendation) => string;
  onToggleExpanded: (key: string) => void;
  onToggleRowSelection: (rec: ReorderRecommendation) => void;
  emptyMessage?: string;
  muted?: boolean;
};

const ABC_BADGE: Record<Exclude<AbcClass, null>, string> = {
  A: "bg-[#111111] text-white",
  B: "bg-[#6B7280] text-white",
  C: "bg-[#E5E7EB] text-[#6B7280]",
};

function compactStatusLabel(status: ReorderStatus): string {
  return status === "reorder_needed" ? "Reorder" : getStatusLabel(status);
}

function formatAvg(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return value.toFixed(1);
}

function CardFlags({ rec }: { rec: ReorderRecommendation }) {
  const hasOnPo = rec.openPoQty > 0;
  const hasInbound = Boolean(rec.inbound);
  if (!hasOnPo && !hasInbound) {
    return <span className="text-[#D1D5DB]">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[#6B7280]">
      {hasOnPo ? (
        <i
          className="ti ti-file-invoice text-[15px] leading-none text-[#6D28D9]"
          title="On platform PO"
          aria-hidden="true"
        />
      ) : null}
      {hasInbound ? (
        <i
          className="ti ti-ship text-[15px] leading-none text-[#1D4ED8]"
          title="Container inbound"
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}

function MetricCell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg bg-[#F9FAFB] px-2.5 py-2">
      <div className="text-[11px] uppercase tracking-wide text-[#6B7280]">
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold tabular-nums text-[#111827]">
        {children}
      </div>
    </div>
  );
}

/**
 * ≤1366 presentation for Reorder Action. Desktop table stays separate and
 * unmodified; CSS toggles which surface is visible.
 */
export function ReorderCardList({
  rows,
  avgMovementWindow,
  selectedKeys,
  expandedSkus,
  seasonalityBySku,
  explanationCache,
  explanationLoading,
  rowKey,
  onToggleExpanded,
  onToggleRowSelection,
  emptyMessage = "No rows match the current filters.",
  muted = false,
}: ReorderCardListProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-card">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {rows.map((rec) => {
        const key = rowKey(rec);
        const isExpanded = expandedSkus.has(key);
        const isSelected = selectedKeys.has(key);
        const purchaseBlocked = isPurchaseBlockedRule(rec.purchaseRule);
        const doNotBuyBadge = getDoNotBuyBadgeMeta(rec.purchaseRule);
        const pack = parseUom(rec.unitOfMeasure);
        const avgValue =
          avgMovementWindow === 6 ? rec.avgUnits6mo : rec.avgUnits12mo;
        const leadLabel =
          rec.effectiveLeadTimeDays != null &&
          Number.isFinite(rec.effectiveLeadTimeDays) &&
          rec.effectiveLeadTimeDays > 0
            ? `${formatNumber(rec.effectiveLeadTimeDays)}d`
            : "—";
        const rounded = isExpanded ? "rounded-t-[14px]" : "rounded-[14px]";

        return (
          <div key={key} className={muted ? "opacity-80" : undefined}>
            <div
              className={`border border-[#E5E7EB] bg-white ${rounded} px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${
                isExpanded ? "border-b-0" : ""
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={rec.status === "no_demand" || purchaseBlocked}
                  onChange={() => onToggleRowSelection(rec)}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`Select ${rec.sku}`}
                  title={doNotBuyBadge?.title}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-tbc-red focus:ring-tbc-red/20 disabled:cursor-not-allowed disabled:opacity-40"
                />
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  onClick={() => onToggleExpanded(key)}
                  aria-expanded={isExpanded}
                >
                  <span className="font-mono text-sm font-semibold text-[#111827]">
                    {rec.sku}
                  </span>
                  {rec.abcClass ? (
                    <span
                      className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md px-1.5 text-[11px] font-semibold ${ABC_BADGE[rec.abcClass]}`}
                    >
                      {rec.abcClass}
                    </span>
                  ) : null}
                  <Badge
                    variant={getStatusBadgeVariant(rec.status)}
                    className="whitespace-nowrap !px-2.5 leading-none"
                  >
                    {compactStatusLabel(rec.status)}
                  </Badge>
                  {doNotBuyBadge ? (
                    <span className={doNotBuyBadge.className}>
                      {doNotBuyBadge.label}
                    </span>
                  ) : null}
                  <span className="flex-1" />
                  <ChevronRight
                    className={`h-5 w-5 shrink-0 text-[#9CA3AF] transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </div>

              <p className="ml-[26px] mt-2 text-sm text-[#111827]">
                {rec.name ?? "—"}
              </p>

              <div className="ml-[26px] mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-[#6B7280]">
                <span>
                  Supplier:{" "}
                  <span className="text-[#374151]">
                    {resolveSupplierDisplayName(
                      rec.supplierName,
                      rec.supplierExternalId
                    )}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1">
                  Flags: <CardFlags rec={rec} />
                </span>
                <span className="inline-flex items-center gap-1">
                  UOM:{" "}
                  <span className="text-[#374151]">
                    <UomCell pack={pack} />
                  </span>
                </span>
              </div>

              <div className="ml-[26px] mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                <MetricCell label="Qty Avail">
                  {formatNumber(rec.quantityAvailable)}
                </MetricCell>
                <MetricCell label="Suggested">
                  <span className="font-bold">
                    {formatSuggestedQty(rec.suggestedQtyRounded)}
                  </span>
                </MetricCell>
                <MetricCell label={`Avg/mo (${avgMovementWindow})`}>
                  {formatAvg(avgValue)}
                </MetricCell>
                <MetricCell label="Cover">
                  <CoverBadge rec={rec} className="!text-[13px]" />
                </MetricCell>
                <MetricCell label="Lead">{leadLabel}</MetricCell>
              </div>
            </div>

            {isExpanded ? (
              <div className="overflow-hidden rounded-b-[14px] border border-t-0 border-[#E5E7EB]">
                <ReorderExpandedPanel
                  rec={rec}
                  pipeline={rec.pipelineBreakdown}
                  seasonalityProfile={seasonalityBySku[rec.sku] ?? null}
                  explanation={explanationCache.get(key) ?? null}
                  isLoadingExplanation={explanationLoading.has(key)}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
