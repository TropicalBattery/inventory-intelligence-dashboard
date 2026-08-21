"use client";

import { ChevronRight, Search } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchReorderItemExplanation,
  type ReorderItemExplanationResult,
} from "@/app/(main)/reorder/ai-actions";
import { usePoCart } from "@/components/po-cart/po-cart-provider";
import { AiSummaryPanel } from "@/components/reorder/ai-summary-panel";
import { CoverBadge } from "@/components/reorder/months-of-cover-display";
import { ReorderCardList } from "@/components/reorder/reorder-card-list";
import { ReorderExpandedPanel } from "@/components/reorder/reorder-expanded-panel";
import { SavedViewsControls } from "@/components/reorder/saved-views-controls";
import {
  ListingToolbar,
  listingControlClassName,
  listingExportButtonClassName,
  listingLabelClassName,
  listingSearchInputClassName,
} from "@/components/shared/listing-toolbar";
import { MultiSelectFilter } from "@/components/shared/multi-select-filter";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatNumber, formatSuggestedQty } from "@/lib/format";
import { parseUom } from "@/lib/format/uom";
import { UomCell } from "@/components/shared/uom-cell";
import {
  type AbcClass,
} from "@/lib/reorder/abc";
import {
  countNoDemandRecommendations,
  filterMainRecommendations,
  filterNoDemandRecommendations,
  sortReorderActionRows,
  summarizeReorderStatuses,
} from "@/lib/reorder-filters";
import {
  getDoNotBuyBadgeMeta,
  isPurchaseBlockedRule,
  resolveCartSupplierForRule,
} from "@/lib/reorder/purchase-rules-ui";
import { inboundReliefStatus } from "@/lib/reorder/inbound-relief";
import {
  formatZeroReasonExclusionSummary,
  getZeroReasonText,
} from "@/lib/reorder/zero-reason-text";
import { getZeroReasonNarrative } from "@/lib/reorder/zero-reason-narrative";
import { countReorderTabAttention } from "@/lib/reorder-tab-classification";
import {
  getStatusBadgeVariant,
  getStatusLabel,
} from "@/lib/reorder-status-ui";
import {
  downloadBytesFile,
  downloadTextFile,
} from "@/lib/reorder/download-client";
import {
  buildReorderExportCsv,
  buildReorderExportFilename,
  buildReorderExportPdf,
  buildReorderExportRows,
} from "@/lib/reorder/export";
import {
  DEFAULT_REORDER_ACTION_VIEW_FILTERS,
  parseReorderActionViewFilters,
  reorderActionViewFiltersEqual,
  type AbcClassFilter,
  type ReorderActionViewFilters,
  type SortDirection,
  type SortKey,
  type StatusFilter,
} from "@/lib/reorder/view-filters";
import type { ItemSeasonalityProfile } from "@/lib/seasonality/types";
import type {
  ReorderRecommendation,
  ReorderStatus,
  VelocityDiagnostic,
} from "@/lib/types";
import {
  formatSupplierOptionLabel,
  resolveSupplierDisplayName,
  type SupplierFilterOption,
} from "@/lib/queries/suppliers";

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "watch", label: "Watch" },
  { value: "reorder_needed", label: "Reorder Needed" },
  { value: "ok", label: "OK (well stocked)" },
];

const ABC_CLASS_FILTER_OPTIONS: { value: AbcClassFilter; label: string }[] = [
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
];

type ReorderActionTabProps = {
  recommendations: ReorderRecommendation[];
  diagnosticsBySku: Record<string, VelocityDiagnostic>;
  seasonalityBySku: Record<string, ItemSeasonalityProfile>;
  onAttentionCountChange: (count: number) => void;
  /** When set, show muted "active inventory only" note in the filter bar. */
  activeInventorySkuCount?: number | null;
  /** Full vendor list for the filter (refs + locks + names). */
  supplierFilterOptions?: SupplierFilterOption[];
};

type FilterBarSort =
  | "urgency"
  | "sku-asc"
  | "qty-available-asc"
  | "suggested-qty-desc";

const COLLAPSED_COLUMN_COUNT = 12;

type AvgMovementWindow = 6 | 12;

const SIGNALS_COLUMN_CLASS = "w-14 px-2 text-center";
/** Room for cover pill + inbound-relief cue ("ETA passed") on one line. */
const COVER_COLUMN_CLASS = "w-36 overflow-visible px-2";

/**
 * Uniform micro-label style for every header cell (TBC pattern). Applied via
 * the thead so plain and sortable headers render identically — Tailwind's
 * preflight strips text-transform from <button>, so the sortable headers'
 * buttons also need `uppercase` (see SortableHeader).
 */
const HEADER_TEXT_CLASS =
  "[&_th]:!text-[11px] [&_th]:!font-medium [&_th]:uppercase [&_th]:!tracking-wider [&_th]:text-[#6B7280]";

const STATUS_BADGE_CLASS = "whitespace-nowrap !px-2 leading-none";

/**
 * Table-only short labels. The shared getStatusLabel stays untouched because
 * exports, inventory and PO review render the full wording.
 */
function getCompactStatusLabel(status: ReorderStatus): string {
  return status === "reorder_needed" ? "Reorder" : getStatusLabel(status);
}

const UOM_COLUMN_CLASS = "hidden w-14 px-2 text-left text-xs lg:table-cell";
const QTY_AVAILABLE_COLUMN_CLASS = "hidden text-right md:table-cell";
const SUPPLIER_COLUMN_CLASS = "hidden min-w-0 lg:table-cell";
const TABLE_CONTAINER_CLASS =
  "w-full max-w-full min-w-0 rounded-none border-0 shadow-none !overflow-visible";
const TABLE_CLASS = "table-fixed w-full !min-w-0";

const STATUS_ORDER: Record<ReorderStatus, number> = {
  critical: 0,
  watch: 1,
  reorder_needed: 2,
  ok: 3,
  no_demand: 4,
};

const ABC_ROW_BADGE_BASE =
  "inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-bold ml-2 align-middle";

const ABC_ROW_BADGE_TONE: Record<Exclude<AbcClass, null>, string> = {
  A: "bg-[#111111] text-white",
  B: "bg-[#6B7280] text-white",
  C: "bg-[#E5E7EB] text-[#6B7280]",
};

const ABC_ROW_BADGE_TITLE: Record<Exclude<AbcClass, null>, string> = {
  A: "Class A - top sellers (~80% of sales value)",
  B: "Class B - mid movers",
  C: "Class C - long tail",
};

const FLAG_ICON_CLASS = "ti text-[15px] leading-none";

/** Purple invoice — platform purchase order raised. Shared by rows + legend. */
function OnPoFlagIcon({
  title,
  className,
}: {
  title?: string;
  className?: string;
}) {
  return (
    <i
      className={[FLAG_ICON_CLASS, "ti-file-invoice text-[#6D28D9]", className]
        .filter(Boolean)
        .join(" ")}
      title={title}
      aria-label={title ?? "On platform PO"}
      aria-hidden={title ? undefined : true}
    />
  );
}

/** Blue ship — supplier container on the water. Shared by rows + legend. */
function InboundFlagIcon({
  title,
  className,
}: {
  title?: string;
  className?: string;
}) {
  return (
    <i
      className={[FLAG_ICON_CLASS, "ti-ship text-[#1D4ED8]", className]
        .filter(Boolean)
        .join(" ")}
      title={title}
      aria-label={title ?? "Container inbound"}
      aria-hidden={title ? undefined : true}
    />
  );
}

/** Purple calendar — seasonal demand peak. Shared by product-name cells + legend. */
function SeasonalFlagIcon({
  title,
  className,
}: {
  title?: string;
  className?: string;
}) {
  return (
    <i
      className={[
        FLAG_ICON_CLASS,
        "ti-calendar-stats text-[#6D28D9]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={title}
      aria-label={title ?? "Seasonal peak"}
      aria-hidden={title ? undefined : true}
    />
  );
}

function FlagsLegend() {
  return (
    <span className="inline-flex flex-wrap items-center gap-3 text-[11px] text-[#6B7280]">
      <span className="font-medium">Flags:</span>
      <span className="inline-flex items-center gap-1">
        <OnPoFlagIcon />
        On platform PO
      </span>
      <span className="inline-flex items-center gap-1">
        <InboundFlagIcon />
        Container inbound
      </span>
      <span className="inline-flex items-center gap-1">
        <SeasonalFlagIcon />
        Seasonal peak
      </span>
    </span>
  );
}

/**
 * Compact per-row flag icons, kept out of the Supplier cell so the name and
 * chips never compete for width. Icons only in the row; full text on hover.
 * On PO (platform purchase order) = purple invoice; Inbound (supplier
 * container on the water, supplier-level) = blue ship. Distinct on purpose.
 */
function SignalsCell({ rec }: { rec: ReorderRecommendation }) {
  const hasOnPo = rec.openPoQty > 0;
  const hasInbound = Boolean(rec.inbound);

  if (!hasOnPo && !hasInbound) {
    return <span className="text-[#D1D5DB]">—</span>;
  }

  const supplierLabel = resolveSupplierDisplayName(
    rec.supplierName,
    rec.supplierExternalId
  );

  const poNumber = rec.openPoRefs[0]?.poNumber;
  const onPoTitle = hasOnPo
    ? `On platform PO: ${formatNumber(rec.openPoQty)} unit${
        rec.openPoQty === 1 ? "" : "s"
      }${poNumber ? ` (${poNumber})` : ""}`
    : undefined;

  const inboundTitle = rec.inbound
    ? `${formatNumber(rec.inbound.containerCount)} container${
        rec.inbound.containerCount === 1 ? "" : "s"
      } inbound from ${supplierLabel}, ETA ${rec.inbound.etaLabel}`
    : undefined;

  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      {hasOnPo ? <OnPoFlagIcon title={onPoTitle} /> : null}
      {hasInbound ? <InboundFlagIcon title={inboundTitle} /> : null}
    </span>
  );
}

/**
 * Advisory ETA cue beside the COVER pill for Critical/Watch rows only.
 * Never reclassifies status or changes cover math — presentation only.
 */
function InboundReliefCue({ rec }: { rec: ReorderRecommendation }) {
  if (rec.status !== "critical" && rec.status !== "watch") {
    return null;
  }

  const relief = inboundReliefStatus(rec);
  if (!relief) {
    return null;
  }

  if (relief.kind === "imminent") {
    return (
      <span
        className="shrink-0 whitespace-nowrap text-[10px] leading-none text-[#16A34A]"
        title={relief.label}
      >
        {relief.label}
      </span>
    );
  }

  if (relief.kind === "inbound") {
    return (
      <span
        className="shrink-0 whitespace-nowrap text-[10px] leading-none text-[#9CA3AF]"
        title={relief.label}
      >
        inbound
      </span>
    );
  }

  return (
    <span
      className="shrink-0 whitespace-nowrap text-[10px] leading-none text-[#B45309]"
      title="Container ETA has passed - stock may not be received yet; check receiving"
    >
      ETA passed
    </span>
  );
}

function rowKey(rec: ReorderRecommendation): string {
  return rec.sku;
}

function SuggestedQtyCell({ rec }: { rec: ReorderRecommendation }) {
  const zeroReason = getZeroReasonText(rec);

  return (
    <span
      className="font-semibold tabular-nums text-slate-900"
      title={zeroReason?.detail}
    >
      {formatSuggestedQty(rec.suggestedQtyRounded)}
    </span>
  );
}

function formatAvgMonthlyUnits(value: number | null): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return value.toFixed(1);
}

function AvgMonthlyCell({
  rec,
  windowMonths,
}: {
  rec: ReorderRecommendation;
  windowMonths: AvgMovementWindow;
}) {
  const value = windowMonths === 6 ? rec.avgUnits6mo : rec.avgUnits12mo;
  return (
    <span className="tabular-nums text-slate-900">
      {formatAvgMonthlyUnits(value)}
    </span>
  );
}

function AvgMovementWindowToggle({
  value,
  onChange,
}: {
  value: AvgMovementWindow;
  onChange: (next: AvgMovementWindow) => void;
}) {
  const segmentClass = (active: boolean) =>
    `rounded px-2 py-1 text-xs font-medium transition-colors ${
      active
        ? "bg-white text-slate-900 shadow-sm"
        : "text-slate-500 hover:text-slate-700"
    }`;

  return (
    <div
      className="inline-flex items-center gap-2"
      role="group"
      aria-label="Average monthly movement window"
    >
      <span className="text-xs text-slate-500">Avg / mo</span>
      <div className="inline-flex rounded-md bg-slate-100 p-0.5">
        <button
          type="button"
          className={segmentClass(value === 6)}
          aria-pressed={value === 6}
          onClick={() => onChange(6)}
        >
          6 mo
        </button>
        <button
          type="button"
          className={segmentClass(value === 12)}
          aria-pressed={value === 12}
          onClick={() => onChange(12)}
        >
          12 mo
        </button>
      </div>
    </div>
  );
}

function StatusCell({ rec }: { rec: ReorderRecommendation }) {
  const doNotBuyBadge = getDoNotBuyBadgeMeta(rec.purchaseRule);

  return (
    <span className="inline-flex min-w-0 flex-col items-start gap-1">
      <Badge
        variant={getStatusBadgeVariant(rec.status)}
        className={STATUS_BADGE_CLASS}
      >
        {getCompactStatusLabel(rec.status)}
      </Badge>
      {doNotBuyBadge ? (
        <span className={doNotBuyBadge.className} title={doNotBuyBadge.title}>
          {doNotBuyBadge.label}
        </span>
      ) : null}
    </span>
  );
}

const EXCLUSION_BANNER_CAP = 3;

type ExclusionBannerLine = {
  sku: string;
  shortReason: string;
  detail: string;
  narrative: string | null;
};

type AddNotice = {
  addedCount: number;
  excluded: ExclusionBannerLine[];
  /** Parenthetical tally for collapsed (>CAP) headers, e.g. "10 already covered, 2 ordering off". */
  tallyPhrase: string | null;
};

/** Amber watch/warning surface — informational guidance, not a failure. */
const ADD_NOTICE_BANNER_CLASS =
  "mt-4 w-full rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]";

function buildExclusionBannerLines(
  excluded: ReorderRecommendation[]
): ExclusionBannerLine[] {
  return excluded.map((rec) => {
    const text = getZeroReasonText(rec);
    return {
      sku: rec.sku,
      shortReason: text?.short.toLowerCase() ?? "no suggested quantity",
      detail:
        text?.detail ??
        "Selected item needs a suggested quantity greater than 0, or purchasing is blocked.",
      narrative: getZeroReasonNarrative(rec),
    };
  });
}

/** Parenthetical tally from formatZeroReasonExclusionSummary. */
function exclusionTallyParenthetical(
  excluded: Array<Pick<ReorderRecommendation, "suggestedQtyZeroReason">>
): string | null {
  const summary = formatZeroReasonExclusionSummary(excluded);
  if (!summary) {
    return null;
  }

  const match = summary.match(/excluded:\s*(.+?)\.?$/i);
  return match?.[1]?.trim() ?? null;
}

function ExclusionAccordionList({ lines }: { lines: ExclusionBannerLine[] }) {
  const [openSkus, setOpenSkus] = useState<Set<string>>(() => new Set());

  function toggleSku(sku: string) {
    setOpenSkus((current) => {
      const next = new Set(current);
      if (next.has(sku)) {
        next.delete(sku);
      } else {
        next.add(sku);
      }
      return next;
    });
  }

  return (
    <ul className="mt-1.5">
      {lines.map((line, index) => {
        const isOpen = openSkus.has(line.sku);
        const hasNarrative = Boolean(line.narrative);

        return (
          <li
            key={line.sku}
            className={
              index === 0 ? undefined : "border-t border-[#FDE68A]/70"
            }
          >
            <button
              type="button"
              onClick={() => {
                if (hasNarrative) {
                  toggleSku(line.sku);
                }
              }}
              aria-expanded={hasNarrative ? isOpen : undefined}
              title={line.detail}
              className="flex w-full items-start gap-1.5 py-1.5 text-left text-xs font-normal text-[#A16207] transition-colors hover:text-[#92400E]"
            >
              <ChevronRight
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${
                  isOpen ? "rotate-90" : ""
                } ${hasNarrative ? "opacity-100" : "opacity-40"}`}
                aria-hidden="true"
              />
              <span>
                {line.sku} — {line.shortReason}
              </span>
            </button>
            {isOpen && line.narrative ? (
              <p className="w-full pb-2 pl-5 text-xs font-normal leading-relaxed text-[#A16207]/90">
                {line.narrative}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function AddNoticeBanner({
  notice,
  detailsExpanded,
  onToggleDetails,
}: {
  notice: AddNotice;
  detailsExpanded: boolean;
  onToggleDetails: () => void;
}) {
  const { addedCount, excluded, tallyPhrase } = notice;
  const n = excluded.length;
  const itemWord = n === 1 ? "item" : "items";
  const collapse = n > EXCLUSION_BANNER_CAP;
  const showLines = !collapse || detailsExpanded;
  const header =
    collapse && tallyPhrase
      ? `${n} ${itemWord} not added (${tallyPhrase})`
      : `${n} ${itemWord} not added`;

  return (
    <div role="status" className={ADD_NOTICE_BANNER_CLASS}>
      {addedCount > 0 ? (
        <p className="font-medium text-[#92400E]">
          Added {addedCount} {addedCount === 1 ? "item" : "items"} to PO cart
        </p>
      ) : null}
      {n > 0 ? (
        <div className={addedCount > 0 ? "mt-2" : undefined}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">{header}</p>
            {collapse ? (
              <button
                type="button"
                onClick={onToggleDetails}
                className="text-xs font-semibold text-[#B45309] underline-offset-2 hover:underline"
              >
                {detailsExpanded ? "Hide details" : "Show details"}
              </button>
            ) : null}
          </div>
          {showLines ? <ExclusionAccordionList lines={excluded} /> : null}
        </div>
      ) : null}
    </div>
  );
}

const coverMonths = (rec: ReorderRecommendation): number => {
  if (!rec.avgDailyDemandUnits || rec.avgDailyDemandUnits <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return (
    (rec.quantityAvailable + rec.quantityOnOrder) /
    (rec.avgDailyDemandUnits * 30.44)
  );
};

function filterBarSortFromState(
  sortKey: SortKey,
  direction: SortDirection
): FilterBarSort | "" {
  if (sortKey === "coverMonths" && direction === "asc") {
    return "urgency";
  }
  if (sortKey === "sku" && direction === "asc") {
    return "sku-asc";
  }
  if (sortKey === "quantityAvailable" && direction === "asc") {
    return "qty-available-asc";
  }
  if (sortKey === "suggestedQtyRounded" && direction === "desc") {
    return "suggested-qty-desc";
  }
  return "";
}

function applyFilterBarSort(option: FilterBarSort): {
  sortKey: SortKey;
  sortDirection: SortDirection;
} {
  switch (option) {
    case "urgency":
      return { sortKey: "coverMonths", sortDirection: "asc" };
    case "sku-asc":
      return { sortKey: "sku", sortDirection: "asc" };
    case "qty-available-asc":
      return { sortKey: "quantityAvailable", sortDirection: "asc" };
    case "suggested-qty-desc":
      return { sortKey: "suggestedQtyRounded", sortDirection: "desc" };
  }
}

function compareValues(
  left: string | number | null,
  right: string | number | null,
  direction: SortDirection
): number {
  const multiplier = direction === "asc" ? 1 : -1;

  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  if (typeof left === "number" && typeof right === "number") {
    return (left - right) * multiplier;
  }

  return String(left).localeCompare(String(right)) * multiplier;
}

function sortRecommendations(
  rows: ReorderRecommendation[],
  sortKey: SortKey,
  direction: SortDirection
): ReorderRecommendation[] {
  if (sortKey === "status") {
    const sorted = sortReorderActionRows(rows);
    return direction === "desc" ? sorted.reverse() : sorted;
  }

  const sorted = [...rows];

  sorted.sort((a, b) => {
    switch (sortKey) {
      case "sku":
        return compareValues(a.sku, b.sku, direction);
      case "name":
        return compareValues(a.name, b.name, direction);
      case "quantityAvailable":
        return compareValues(a.quantityAvailable, b.quantityAvailable, direction);
      case "suggestedQtyRounded":
        return compareValues(
          a.suggestedQtyRounded,
          b.suggestedQtyRounded,
          direction
        );
      case "supplierName":
        return compareValues(
          a.supplierName ?? a.supplierExternalId,
          b.supplierName ?? b.supplierExternalId,
          direction
        );
      case "coverMonths":
        return compareValues(coverMonths(a), coverMonths(b), direction);
      default:
        return 0;
    }
  });

  return sorted;
}

function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  direction,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const isActive = activeSortKey === sortKey;
  const arrow = isActive ? (direction === "asc" ? " ^" : " v") : "";

  return (
    <TableHead
      className={[
        align === "right" ? "text-right" : "text-left",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 uppercase hover:text-slate-900"
      >
        {label}
        <span className="text-xs text-slate-400">{arrow}</span>
      </button>
    </TableHead>
  );
}

export function ReorderActionTab({
  recommendations,
  diagnosticsBySku,
  seasonalityBySku,
  onAttentionCountChange,
  activeInventorySkuCount = null,
  supplierFilterOptions = [],
}: ReorderActionTabProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter[]>(() => [
    ...DEFAULT_REORDER_ACTION_VIEW_FILTERS.statusFilter,
  ]);
  const [abcClassFilter, setAbcClassFilter] = useState<AbcClassFilter[]>(
    () => [...DEFAULT_REORDER_ACTION_VIEW_FILTERS.abcClassFilter]
  );
  const [showNoDemandItems, setShowNoDemandItems] = useState(
    DEFAULT_REORDER_ACTION_VIEW_FILTERS.showNoDemandItems
  );
  const [searchQuery, setSearchQuery] = useState(
    DEFAULT_REORDER_ACTION_VIEW_FILTERS.searchQuery
  );
  const [supplierFilter, setSupplierFilter] = useState<string[]>(() => [
    ...DEFAULT_REORDER_ACTION_VIEW_FILTERS.supplierFilter,
  ]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkOpenPoConfirmPending, setBulkOpenPoConfirmPending] =
    useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(
    DEFAULT_REORDER_ACTION_VIEW_FILTERS.sortKey
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    DEFAULT_REORDER_ACTION_VIEW_FILTERS.sortDirection
  );
  const [expandedSkus, setExpandedSkus] = useState<Set<string>>(new Set());
  const [explanationCache, setExplanationCache] = useState<
    Map<string, ReorderItemExplanationResult>
  >(new Map());
  const [explanationLoading, setExplanationLoading] = useState<Set<string>>(
    new Set()
  );
  const explanationCacheRef = useRef(explanationCache);
  const explanationLoadingRef = useRef(explanationLoading);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addNotice, setAddNotice] = useState<AddNotice | null>(null);
  const [exclusionDetailsExpanded, setExclusionDetailsExpanded] =
    useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isExporting, setIsExporting] = useState<"csv" | "pdf" | null>(null);
  const [avgMovementWindow, setAvgMovementWindow] =
    useState<AvgMovementWindow>(6);
  const { addItems, open: openPoCart } = usePoCart();

  const currentViewFilters = useMemo<ReorderActionViewFilters>(
    () => ({
      statusFilter,
      abcClassFilter,
      showNoDemandItems,
      searchQuery,
      supplierFilter,
      sortKey,
      sortDirection,
    }),
    [
      statusFilter,
      abcClassFilter,
      showNoDemandItems,
      searchQuery,
      supplierFilter,
      sortKey,
      sortDirection,
    ]
  );

  const applyViewFilters = useCallback((next: ReorderActionViewFilters) => {
    setStatusFilter([...next.statusFilter]);
    setAbcClassFilter([...next.abcClassFilter]);
    setShowNoDemandItems(next.showNoDemandItems);
    setSearchQuery(next.searchQuery);
    setSupplierFilter([...next.supplierFilter]);
    setSortKey(next.sortKey);
    setSortDirection(next.sortDirection);
  }, []);

  explanationCacheRef.current = explanationCache;
  explanationLoadingRef.current = explanationLoading;

  const ensureExplanation = useCallback((sku: string) => {
    if (
      explanationCacheRef.current.has(sku) ||
      explanationLoadingRef.current.has(sku)
    ) {
      return;
    }

    setExplanationLoading((current) => {
      const next = new Set(current);
      next.add(sku);
      explanationLoadingRef.current = next;
      return next;
    });

    void fetchReorderItemExplanation(sku)
      .then((result) => {
        setExplanationCache((current) => {
          const next = new Map(current);
          next.set(sku, result);
          explanationCacheRef.current = next;
          return next;
        });
      })
      .catch(() => {
        setExplanationCache((current) => {
          const next = new Map(current);
          next.set(sku, {
            explanation: "Could not load explanation. Please try again.",
            source: "fallback",
            dataGaps: [],
          });
          explanationCacheRef.current = next;
          return next;
        });
      })
      .finally(() => {
        setExplanationLoading((current) => {
          const next = new Set(current);
          next.delete(sku);
          explanationLoadingRef.current = next;
          return next;
        });
      });
  }, []);

  function toggleExpanded(sku: string) {
    setExpandedSkus((current) => {
      const next = new Set(current);
      if (next.has(sku)) {
        next.delete(sku);
      } else {
        next.add(sku);
        ensureExplanation(sku);
      }
      return next;
    });
  }

  const supplierOptions = useMemo(() => {
    const byId = new Map<string, SupplierFilterOption>();

    for (const option of supplierFilterOptions) {
      byId.set(option.externalId, option);
    }

    for (const rec of recommendations) {
      const id = rec.supplierExternalId?.trim();
      if (!id || byId.has(id)) {
        continue;
      }
      byId.set(id, {
        externalId: id,
        name: rec.supplierName?.trim() || null,
      });
    }

    return Array.from(byId.values()).sort((left, right) => {
      const leftLabel = (left.name ?? left.externalId).toLocaleLowerCase();
      const rightLabel = (right.name ?? right.externalId).toLocaleLowerCase();
      return leftLabel.localeCompare(rightLabel);
    });
  }, [recommendations, supplierFilterOptions]);

  const noDemandCount = useMemo(
    () => countNoDemandRecommendations(recommendations),
    [recommendations]
  );

  const mainRecommendations = useMemo(
    () => filterMainRecommendations(recommendations),
    [recommendations]
  );

  const summaryCounts = useMemo(
    () => summarizeReorderStatuses(recommendations),
    [recommendations]
  );

  const filteredMainRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const statusSet =
      statusFilter.length > 0 ? new Set<string>(statusFilter) : null;
    const abcSet =
      abcClassFilter.length > 0 ? new Set<string>(abcClassFilter) : null;
    const supplierSet =
      supplierFilter.length > 0 ? new Set(supplierFilter) : null;

    return mainRecommendations.filter((rec) => {
      if (statusSet && !statusSet.has(rec.status)) {
        return false;
      }

      if (abcSet && (rec.abcClass == null || !abcSet.has(rec.abcClass))) {
        return false;
      }

      if (supplierSet && !supplierSet.has(rec.supplierExternalId ?? "")) {
        return false;
      }

      if (!query) {
        return true;
      }

      const skuMatch = rec.sku.toLowerCase().includes(query);
      const nameMatch = rec.name?.toLowerCase().includes(query) ?? false;
      return skuMatch || nameMatch;
    });
  }, [
    mainRecommendations,
    searchQuery,
    statusFilter,
    abcClassFilter,
    supplierFilter,
  ]);

  const filteredNoDemandRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const supplierSet =
      supplierFilter.length > 0 ? new Set(supplierFilter) : null;

    return filterNoDemandRecommendations(recommendations).filter((rec) => {
      if (supplierSet && !supplierSet.has(rec.supplierExternalId ?? "")) {
        return false;
      }

      if (!query) {
        return true;
      }

      const skuMatch = rec.sku.toLowerCase().includes(query);
      const nameMatch = rec.name?.toLowerCase().includes(query) ?? false;
      return skuMatch || nameMatch;
    });
  }, [recommendations, searchQuery, supplierFilter]);

  const sortedMainRows = useMemo(
    () => sortRecommendations(filteredMainRows, sortKey, sortDirection),
    [filteredMainRows, sortKey, sortDirection]
  );

  const sortedNoDemandRows = useMemo(
    () => sortRecommendations(filteredNoDemandRows, "sku", "asc"),
    [filteredNoDemandRows]
  );

  const filterDescription = useMemo(() => {
    const parts = [`${sortedMainRows.length} reorderable item(s) in view`];

    if (statusFilter.length > 0) {
      parts.push(`status filter: ${statusFilter.join(", ")}`);
    }

    if (abcClassFilter.length > 0) {
      parts.push(`ABC class: ${abcClassFilter.join(", ")}`);
    }

    if (supplierFilter.length > 0) {
      const labels = supplierFilter.map((id) => {
        const selected = supplierOptions.find(
          (option) => option.externalId === id
        );
        return selected
          ? formatSupplierOptionLabel(selected.name, selected.externalId)
          : id;
      });
      parts.push(`supplier: ${labels.join(", ")}`);
    }

    if (searchQuery.trim()) {
      parts.push(`search: "${searchQuery.trim()}"`);
    }

    return parts.join("; ");
  }, [
    sortedMainRows.length,
    searchQuery,
    statusFilter,
    abcClassFilter,
    supplierFilter,
    supplierOptions,
  ]);

  const supplierMultiSelectOptions = useMemo(
    () =>
      supplierOptions.map((supplier) => ({
        value: supplier.externalId,
        label: formatSupplierOptionLabel(supplier.name, supplier.externalId),
      })),
    [supplierOptions]
  );

  const selectedRows = useMemo(
    () => mainRecommendations.filter((rec) => selectedKeys.has(rowKey(rec))),
    [mainRecommendations, selectedKeys]
  );

  const bulkOpenPoAffected = useMemo(
    () =>
      selectedRows.filter(
        (rec) =>
          rec.openPoQty > 0 &&
          Number.isFinite(rec.openPoQty) &&
          rec.suggestedQtyRounded > 0 &&
          !isPurchaseBlockedRule(rec.purchaseRule)
      ),
    [selectedRows]
  );

  const vendorPoCount = useMemo(() => {
    const suppliers = new Set<string>();
    for (const rec of selectedRows) {
      suppliers.add(rec.supplierName ?? rec.supplierExternalId ?? "unknown");
    }
    return suppliers.size;
  }, [selectedRows]);

  const selectableVisibleKeys = useMemo(
    () =>
      sortedMainRows
        .filter(
          (rec) =>
            rec.status !== "no_demand" &&
            !isPurchaseBlockedRule(rec.purchaseRule)
        )
        .map((rec) => rowKey(rec)),
    [sortedMainRows]
  );

  const allVisibleSelected =
    selectableVisibleKeys.length > 0 &&
    selectableVisibleKeys.every((key) => selectedKeys.has(key));

  const someVisibleSelected = selectableVisibleKeys.some((key) =>
    selectedKeys.has(key)
  );

  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onAttentionCountChange(countReorderTabAttention(recommendations));
  }, [recommendations, onAttentionCountChange]);

  useEffect(() => {
    const el = selectAllCheckboxRef.current;
    if (!el) {
      return;
    }
    el.indeterminate = someVisibleSelected && !allVisibleSelected;
  }, [someVisibleSelected, allVisibleSelected]);

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function toggleRowSelection(rec: ReorderRecommendation) {
    const key = rowKey(rec);
    setBulkOpenPoConfirmPending(false);
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setBulkOpenPoConfirmPending(false);
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const key of selectableVisibleKeys) {
          next.delete(key);
        }
      } else {
        for (const key of selectableVisibleKeys) {
          next.add(key);
        }
      }
      return next;
    });
  }

  async function handleAddSelectedToPo() {
    setActionError(null);
    setAddNotice(null);
    setExclusionDetailsExpanded(false);

    const items = selectedRows
      .filter(
        (rec) =>
          rec.suggestedQtyRounded > 0 && !isPurchaseBlockedRule(rec.purchaseRule)
      )
      .map((rec) => ({
        sku: rec.sku,
        productName: rec.name,
        quantity: rec.suggestedQtyRounded,
        supplierExternalId: resolveCartSupplierForRule(
          rec.purchaseRule,
          rec.supplierExternalId
        ),
        unitPrice: rec.supplierUnitPrice,
        sourceStatus: rec.status,
      }));

    const excludedRecs = selectedRows.filter(
      (rec) =>
        !(
          rec.suggestedQtyRounded > 0 &&
          !isPurchaseBlockedRule(rec.purchaseRule)
        )
    );

    const exclusionNotice = (addedCount: number): AddNotice | null => {
      if (excludedRecs.length === 0 && addedCount === 0) {
        return null;
      }
      if (excludedRecs.length === 0) {
        return null;
      }
      return {
        addedCount,
        excluded: buildExclusionBannerLines(excludedRecs),
        tallyPhrase:
          excludedRecs.length > EXCLUSION_BANNER_CAP
            ? exclusionTallyParenthetical(excludedRecs)
            : null,
      };
    };

    if (items.length === 0) {
      setAddNotice(exclusionNotice(0));
      return;
    }

    const affectedOpenPo = selectedRows.filter(
      (rec) =>
        rec.openPoQty > 0 &&
        rec.suggestedQtyRounded > 0 &&
        !isPurchaseBlockedRule(rec.purchaseRule)
    );

    if (affectedOpenPo.length > 0 && !bulkOpenPoConfirmPending) {
      setBulkOpenPoConfirmPending(true);
      return;
    }

    setBulkOpenPoConfirmPending(false);
    setIsPending(true);
    try {
      await addItems(items);
      openPoCart();
      // Bulk path has no success toast — surface added + not-added in the banner.
      const notice = exclusionNotice(items.length);
      if (notice) {
        setAddNotice(notice);
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Failed to add selected items to cart"
      );
    } finally {
      setIsPending(false);
    }
  }

  async function handleExport(format: "csv" | "pdf") {
    if (isExporting) {
      return;
    }

    setActionError(null);
    setAddNotice(null);
    setIsExporting(format);

    try {
      const generatedAt = new Date();
      const exportRows = buildReorderExportRows(sortedMainRows);
      const meta = {
        filterDescription,
        generatedAt,
        title: "Reorder Action Report",
      };

      if (format === "csv") {
        const csv = buildReorderExportCsv(exportRows, meta);
        downloadTextFile(
          buildReorderExportFilename("csv", generatedAt),
          csv,
          "text/csv;charset=utf-8"
        );
      } else {
        const pdfBytes = await buildReorderExportPdf(exportRows, meta);
        downloadBytesFile(
          buildReorderExportFilename("pdf", generatedAt),
          pdfBytes,
          "application/pdf"
        );
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : `Failed to export ${format.toUpperCase()}`
      );
    } finally {
      setIsExporting(null);
    }
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-6 pr-14">
      <div className="space-y-3 px-1">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[#FCA5A5] bg-[#FDF2F2] px-2.5 py-0.5 text-xs font-medium text-[#CC2B2B]">
            {summaryCounts.critical} Critical
          </span>
          <span className="rounded-full border border-[#B8D9F0] bg-[#E6F1FB] px-2.5 py-0.5 text-xs font-medium text-[#185FA5]">
            {summaryCounts.watch} Watch
          </span>
          <span className="rounded-full border border-[#86EFAC] bg-[#F0FDF4] px-2.5 py-0.5 text-xs font-medium text-[#16A34A]">
            {summaryCounts.ok} OK
          </span>
          <span className="rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-medium text-[#B45309]">
            {summaryCounts.reorder_needed} Reorder Needed
          </span>
        </div>
      </div>

      <AiSummaryPanel
        filteredRecommendations={sortedMainRows}
        diagnosticsBySku={diagnosticsBySku}
        filterDescription={filterDescription}
      />

      <div className="min-w-0 w-full max-w-full">
        <ListingToolbar
          filters={
            <>
              <MultiSelectFilter
                label="Status"
                options={STATUS_FILTER_OPTIONS}
                selected={statusFilter}
                onChange={(values) =>
                  setStatusFilter(values as StatusFilter[])
                }
                placeholder="All statuses"
                className="w-full sm:w-44"
              />
              <MultiSelectFilter
                label="Class"
                options={ABC_CLASS_FILTER_OPTIONS}
                selected={abcClassFilter}
                onChange={(values) =>
                  setAbcClassFilter(values as AbcClassFilter[])
                }
                placeholder="All classes"
                className="w-full sm:w-36"
              />
              <MultiSelectFilter
                label="Supplier"
                options={supplierMultiSelectOptions}
                selected={supplierFilter}
                onChange={setSupplierFilter}
                placeholder="All suppliers"
                className="w-full sm:w-44"
              />
            </>
          }
          search={
            <>
              <label htmlFor="search-filter" className={listingLabelClassName}>
                Search
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="search-filter"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search SKU or name"
                  className={listingSearchInputClassName}
                />
              </div>
            </>
          }
          sort={
            <div className="w-full sm:w-44">
              <label htmlFor="sort-filter" className={listingLabelClassName}>
                Sort
              </label>
              <select
                id="sort-filter"
                value={filterBarSortFromState(sortKey, sortDirection)}
                onChange={(event) => {
                  const next = event.target.value as FilterBarSort;
                  const applied = applyFilterBarSort(next);
                  setSortKey(applied.sortKey);
                  setSortDirection(applied.sortDirection);
                }}
                className={`${listingControlClassName} w-full min-w-0`}
              >
                <option value="" disabled hidden>
                  Custom
                </option>
                <option value="urgency">Most urgent first</option>
                <option value="sku-asc">SKU A-Z</option>
                <option value="qty-available-asc">
                  Qty available (low to high)
                </option>
                <option value="suggested-qty-desc">
                  Suggested qty (high to low)
                </option>
              </select>
            </div>
          }
          actions={
            <>
              <SavedViewsControls
                page="reorder_action"
                filters={currentViewFilters}
                defaultFilters={DEFAULT_REORDER_ACTION_VIEW_FILTERS}
                onApply={applyViewFilters}
                onError={setActionError}
                parseFilters={parseReorderActionViewFilters}
                filtersEqual={reorderActionViewFiltersEqual}
                suggestName={(f) => {
                  if (f.supplierFilter.length > 0) {
                    const statusPart =
                      f.statusFilter.length > 0
                        ? f.statusFilter.join("+")
                        : "all";
                    return `${statusPart} · ${f.supplierFilter.join("+")}`;
                  }
                  if (f.statusFilter.length > 0) {
                    return `${f.statusFilter.join("+")} view`;
                  }
                  return "all statuses view";
                }}
                defaultHint="Apply this view automatically when you open Reorder Action"
              />
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    void handleExport("csv");
                  }}
                  disabled={isExporting !== null}
                  className={listingExportButtonClassName}
                  title="Download the currently filtered rows as CSV for Excel"
                >
                  {isExporting === "csv" ? "Exporting…" : "Export CSV"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleExport("pdf");
                  }}
                  disabled={isExporting !== null}
                  className={listingExportButtonClassName}
                  title="Download a PDF pack of the currently filtered rows"
                >
                  {isExporting === "pdf" ? "Exporting…" : "Export PDF"}
                </button>
              </div>
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-[#6B7280]">
                <input
                  type="checkbox"
                  checked={showNoDemandItems}
                  onChange={(event) =>
                    setShowNoDemandItems(event.target.checked)
                  }
                  className="h-3.5 w-3.5 rounded border-[#E5E7EB] text-tbc-red focus:ring-tbc-red/20"
                />
                Include {noDemandCount.toLocaleString("en-JM")} no-demand SKUs
              </label>
            </>
          }
          meta={
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
              <p title="Sourced from the buyer's Order Tool item master">
                {activeInventorySkuCount != null && activeInventorySkuCount > 0
                  ? `Showing active inventory only (${activeInventorySkuCount.toLocaleString("en-US")} SKUs)`
                  : "\u00a0"}
              </p>
              <FlagsLegend />
            </div>
          }
        />
        <p className="mt-2 text-xs text-[#9CA3AF]">
          Bands scale with each item&apos;s supplier lead time; standard bands
          apply when no lead time is on file.
        </p>

        {addNotice ? (
          <AddNoticeBanner
            notice={addNotice}
            detailsExpanded={exclusionDetailsExpanded}
            onToggleDetails={() =>
              setExclusionDetailsExpanded((current) => !current)
            }
          />
        ) : null}

        {actionError ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {actionError}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-end">
          <AvgMovementWindowToggle
            value={avgMovementWindow}
            onChange={setAvgMovementWindow}
          />
        </div>

        {/* ≤1366: card list. Desktop table stays below and is CSS-hidden under 1366. */}
        <div className="mt-2 hidden max-[1366px]:block">
          <ReorderCardList
            rows={sortedMainRows}
            avgMovementWindow={avgMovementWindow}
            selectedKeys={selectedKeys}
            expandedSkus={expandedSkus}
            seasonalityBySku={seasonalityBySku}
            explanationCache={explanationCache}
            explanationLoading={explanationLoading}
            rowKey={rowKey}
            onToggleExpanded={toggleExpanded}
            onToggleRowSelection={toggleRowSelection}
          />
        </div>

        <div className="mt-2 max-[1366px]:hidden">
        <Card className="w-full max-w-full min-w-0 overflow-visible rounded-2xl p-0">
        {sortedMainRows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            No rows match the current filters.
          </div>
        ) : (
          <Table
            className={TABLE_CLASS}
            containerClassName={TABLE_CONTAINER_CLASS}
          >
            <TableHeader className={`bg-[#F9FAFB] [&_th]:sticky [&_th]:top-[5.125rem] [&_th]:z-20 [&_th]:bg-[#F9FAFB] ${HEADER_TEXT_CLASS}`}>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 px-2">
                  <input
                    ref={selectAllCheckboxRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={selectableVisibleKeys.length === 0}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all visible rows"
                    className="h-4 w-4 rounded border-slate-300 text-tbc-red focus:ring-tbc-red/20 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </TableHead>
                <SortableHeader
                  label="Status"
                  sortKey="status"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="w-24 px-2"
                />
                <SortableHeader
                  label="SKU"
                  sortKey="sku"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="w-28 px-2"
                />
                <SortableHeader
                  label="Product Name"
                  sortKey="name"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="min-w-0 px-2"
                />
                <TableHead className={UOM_COLUMN_CLASS}>UOM</TableHead>
                <SortableHeader
                  label="Qty Available"
                  sortKey="quantityAvailable"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  align="right"
                  className={`${QTY_AVAILABLE_COLUMN_CLASS} w-20 px-2 !whitespace-normal`}
                />
                <SortableHeader
                  label="Suggested Qty"
                  sortKey="suggestedQtyRounded"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  align="right"
                  className="w-20 px-2 !whitespace-normal"
                />
                <TableHead className="w-20 px-2 text-right !whitespace-normal">
                  Avg / mo ({avgMovementWindow})
                </TableHead>
                <SortableHeader
                  label="Supplier"
                  sortKey="supplierName"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                  className={`${SUPPLIER_COLUMN_CLASS} w-28 px-2`}
                />
                <TableHead className={SIGNALS_COLUMN_CLASS}>Flags</TableHead>
                <TableHead className={COVER_COLUMN_CLASS}>Cover</TableHead>
                <TableHead className="w-8 px-1 text-right">
                  <span className="sr-only">Expand</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMainRows.map((rec) => {
                const key = rowKey(rec);
                const isSelected = selectedKeys.has(key);
                const isExpanded = expandedSkus.has(key);
                const seasonalityProfile = seasonalityBySku[rec.sku] ?? null;
                const purchaseBlocked = isPurchaseBlockedRule(rec.purchaseRule);
                const packInfo = parseUom(rec.unitOfMeasure);
                const doNotBuyBadge = getDoNotBuyBadgeMeta(rec.purchaseRule);

                return (
                  <Fragment key={key}>
                    <TableRow
                      className={`cursor-pointer [&>td]:py-2 ${
                        isExpanded ? "bg-slate-50 hover:bg-slate-50" : ""
                      }`}
                      onClick={(event) => {
                        const target = event.target;
                        if (
                          target instanceof HTMLInputElement &&
                          target.type === "checkbox"
                        ) {
                          return;
                        }

                        toggleExpanded(key);
                      }}
                    >
                      <TableCell className="px-2" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={
                            rec.status === "no_demand" || purchaseBlocked
                          }
                          onChange={() => toggleRowSelection(rec)}
                          aria-label={`Select ${rec.sku}`}
                          title={
                            purchaseBlocked
                              ? doNotBuyBadge?.title
                              : undefined
                          }
                          className="h-4 w-4 rounded border-slate-300 text-tbc-red focus:ring-tbc-red/20 disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </TableCell>
                      <TableCell className="w-24 px-2">
                        <StatusCell rec={rec} />
                      </TableCell>
                      <TableCell className="w-28 truncate px-2 font-mono text-xs font-semibold text-slate-900" title={rec.sku}>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate">{rec.sku}</span>
                          {rec.abcClass ? (
                            <span
                              className={`${ABC_ROW_BADGE_BASE} ${ABC_ROW_BADGE_TONE[rec.abcClass]}`}
                              title={ABC_ROW_BADGE_TITLE[rec.abcClass]}
                            >
                              {rec.abcClass}
                            </span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell
                        className="min-w-0 truncate px-2 text-sm text-slate-700"
                        title={rec.name ?? undefined}
                      >
                        <span className="inline-flex max-w-full items-center gap-1.5">
                          <span className="truncate">{rec.name ?? "-"}</span>
                          {rec.seasonality?.isSeasonal ? (
                            <SeasonalFlagIcon
                              className="shrink-0 text-sm"
                              title={`Seasonal: peak ${rec.seasonality.peakLabel ?? ""}`}
                            />
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className={UOM_COLUMN_CLASS}>
                        <UomCell pack={packInfo} />
                      </TableCell>
                      <TableCell
                        className={`${QTY_AVAILABLE_COLUMN_CLASS} w-20 px-2 tabular-nums`}
                      >
                        {formatNumber(rec.quantityAvailable)}
                      </TableCell>
                      <TableCell className="w-20 px-2 text-right tabular-nums">
                        <SuggestedQtyCell rec={rec} />
                      </TableCell>
                      <TableCell className="w-20 px-2 text-right tabular-nums whitespace-nowrap">
                        <AvgMonthlyCell
                          rec={rec}
                          windowMonths={avgMovementWindow}
                        />
                      </TableCell>
                      <TableCell
                        className={`${SUPPLIER_COLUMN_CLASS} w-28 truncate px-2`}
                        title={rec.supplierExternalId ?? undefined}
                      >
                        <span className="truncate">
                          {resolveSupplierDisplayName(
                            rec.supplierName,
                            rec.supplierExternalId
                          )}
                        </span>
                      </TableCell>
                      <TableCell className={SIGNALS_COLUMN_CLASS}>
                        <SignalsCell rec={rec} />
                      </TableCell>
                      <TableCell className={COVER_COLUMN_CLASS}>
                        <span className="inline-flex max-w-full items-center gap-1">
                          <CoverBadge rec={rec} />
                          <InboundReliefCue rec={rec} />
                        </span>
                      </TableCell>
                      <TableCell className="w-8 px-1 text-right">
                        <ChevronRight
                          className={`ml-auto h-4 w-4 text-slate-400 transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                          aria-hidden="true"
                        />
                      </TableCell>
                    </TableRow>
                    {isExpanded ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={COLLAPSED_COLUMN_COUNT} className="p-0">
                          <ReorderExpandedPanel
                            rec={rec}
                            pipeline={rec.pipelineBreakdown}
                            seasonalityProfile={seasonalityProfile}
                            explanation={explanationCache.get(key) ?? null}
                            isLoadingExplanation={explanationLoading.has(key)}
                          />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
        </Card>
        </div>
      </div>

      {showNoDemandItems && sortedNoDemandRows.length > 0 ? (
        <div className="min-w-0 w-full max-w-full space-y-3">
          <p className="px-1 text-sm text-[var(--color-text-secondary)]">
            No demand in last 13 months. May be slow-moving, seasonal, or
            discontinued.
          </p>
          <div className="hidden max-[1366px]:block">
            <ReorderCardList
              rows={sortedNoDemandRows}
              avgMovementWindow={avgMovementWindow}
              selectedKeys={selectedKeys}
              expandedSkus={expandedSkus}
              seasonalityBySku={seasonalityBySku}
              explanationCache={explanationCache}
              explanationLoading={explanationLoading}
              rowKey={rowKey}
              onToggleExpanded={toggleExpanded}
              onToggleRowSelection={toggleRowSelection}
              muted
            />
          </div>
          <div className="max-[1366px]:hidden">
          <Card className="w-full max-w-full min-w-0 overflow-visible rounded-2xl p-0">
            <Table
              className={TABLE_CLASS}
              containerClassName={TABLE_CONTAINER_CLASS}
            >
              <TableHeader className={`bg-[#F9FAFB] [&_th]:sticky [&_th]:top-[5.125rem] [&_th]:z-20 [&_th]:bg-[#F9FAFB] ${HEADER_TEXT_CLASS}`}>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 px-2">
                    <span className="sr-only">Select</span>
                  </TableHead>
                  <TableHead className="w-24 px-2">Status</TableHead>
                  <TableHead className="w-28 px-2">SKU</TableHead>
                  <TableHead className="min-w-0 px-2">Product Name</TableHead>
                  <TableHead className={UOM_COLUMN_CLASS}>UOM</TableHead>
                  <TableHead
                    className={`${QTY_AVAILABLE_COLUMN_CLASS} w-20 px-2 !whitespace-normal`}
                  >
                    Qty Available
                  </TableHead>
                  <TableHead className="w-20 px-2 text-right !whitespace-normal">
                    Suggested Qty
                  </TableHead>
                  <TableHead className="w-20 px-2 text-right !whitespace-normal">
                    Avg / mo ({avgMovementWindow})
                  </TableHead>
                  <TableHead className={`${SUPPLIER_COLUMN_CLASS} w-28 px-2`}>
                    Supplier
                  </TableHead>
                  <TableHead className={SIGNALS_COLUMN_CLASS}>Flags</TableHead>
                  <TableHead className={COVER_COLUMN_CLASS}>Cover</TableHead>
                  <TableHead className="w-8 px-1 text-right">
                    <span className="sr-only">Expand</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedNoDemandRows.map((rec) => {
                  const key = rowKey(rec);
                  const isExpanded = expandedSkus.has(key);
                  const seasonalityProfile = seasonalityBySku[rec.sku] ?? null;
                  const mutedClassName = "text-[var(--color-text-secondary)]";
                  const packInfo = parseUom(rec.unitOfMeasure);

                  return (
                    <Fragment key={`no-demand-${key}`}>
                      <TableRow
                        className={`cursor-pointer [&>td]:py-2 ${mutedClassName} ${
                          isExpanded ? "bg-slate-50 hover:bg-slate-50" : ""
                        }`}
                        onClick={() => toggleExpanded(key)}
                      >
                        <TableCell
                          className="px-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            disabled
                            aria-label={`Select ${rec.sku}`}
                            className="h-4 w-4 rounded border-slate-300 opacity-40"
                          />
                        </TableCell>
                        <TableCell className="w-24 px-2">
                          <StatusCell rec={rec} />
                        </TableCell>
                        <TableCell
                          className="w-28 truncate px-2 font-mono text-xs font-semibold"
                          title={rec.sku}
                        >
                          {rec.sku}
                        </TableCell>
                        <TableCell
                          className="min-w-0 truncate px-2 text-sm"
                          title={rec.name ?? undefined}
                        >
                          <span className="inline-flex max-w-full items-center gap-1.5">
                            <span className="truncate">{rec.name ?? "-"}</span>
                            {rec.seasonality?.isSeasonal ? (
                              <SeasonalFlagIcon
                                className="shrink-0 text-sm"
                                title={`Seasonal: peak ${rec.seasonality.peakLabel ?? ""}`}
                              />
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell className={UOM_COLUMN_CLASS}>
                          <UomCell pack={packInfo} />
                        </TableCell>
                        <TableCell
                          className={`${QTY_AVAILABLE_COLUMN_CLASS} w-20 px-2 tabular-nums`}
                        >
                          {formatNumber(rec.quantityAvailable)}
                        </TableCell>
                        <TableCell className="w-20 px-2 text-right tabular-nums">
                          <SuggestedQtyCell rec={rec} />
                        </TableCell>
                        <TableCell className="w-20 px-2 text-right tabular-nums whitespace-nowrap">
                          <AvgMonthlyCell
                            rec={rec}
                            windowMonths={avgMovementWindow}
                          />
                        </TableCell>
                        <TableCell
                          className={`${SUPPLIER_COLUMN_CLASS} w-28 truncate px-2`}
                          title={rec.supplierExternalId ?? undefined}
                        >
                          <span className="truncate">
                            {resolveSupplierDisplayName(
                              rec.supplierName,
                              rec.supplierExternalId
                            )}
                          </span>
                        </TableCell>
                        <TableCell className={SIGNALS_COLUMN_CLASS}>
                          <SignalsCell rec={rec} />
                        </TableCell>
                        <TableCell className={COVER_COLUMN_CLASS}>
                          <span className="inline-flex max-w-full items-center gap-1">
                            <CoverBadge rec={rec} />
                            <InboundReliefCue rec={rec} />
                          </span>
                        </TableCell>
                        <TableCell className="w-8 px-1 text-right">
                          <ChevronRight
                            className={`ml-auto h-4 w-4 transition-transform ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                            aria-hidden="true"
                          />
                        </TableCell>
                      </TableRow>
                      {isExpanded ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell
                            colSpan={COLLAPSED_COLUMN_COUNT}
                            className="p-0"
                          >
                            <ReorderExpandedPanel
                              rec={rec}
                              pipeline={rec.pipelineBreakdown}
                              seasonalityProfile={seasonalityProfile}
                              explanation={explanationCache.get(key) ?? null}
                              isLoadingExplanation={explanationLoading.has(
                                key
                              )}
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          </div>
        </div>
      ) : null}

      <div className="sticky bottom-0 z-40 w-full max-w-full min-w-0 space-y-3 rounded-2xl border border-transparent bg-white px-4 py-4 shadow-card shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] sm:px-6">
        {bulkOpenPoConfirmPending && bulkOpenPoAffected.length > 0 ? (
          <div
            role="status"
            className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1E3A8A]"
          >
            <p className="font-medium">
              Some selected SKUs already have units on platform POs. Add
              anyway?
            </p>
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
              {bulkOpenPoAffected.map((rec) => {
                const primary = rec.openPoRefs[0];
                const statusLabel = primary
                  ? primary.status.replace(/_/g, " ")
                  : "";
                return (
                  <li key={rowKey(rec)}>
                    {rec.sku}: {formatNumber(rec.openPoQty)} units
                    {primary
                      ? ` on ${primary.poNumber} (${statusLabel})`
                      : ""}
                    {rec.openPoRefs.length > 1
                      ? ` +${rec.openPoRefs.length - 1} more`
                      : ""}
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  void handleAddSelectedToPo();
                }}
                className="rounded-xl bg-tbc-red px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-tbc-red-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Adding to cart..." : "Add anyway"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setBulkOpenPoConfirmPending(false)}
                className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-700">
            {selectedRows.length} item{selectedRows.length === 1 ? "" : "s"}{" "}
            selected across {vendorPoCount} supplier
            {vendorPoCount === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            disabled={
              isPending ||
              selectedRows.length === 0 ||
              (bulkOpenPoConfirmPending && bulkOpenPoAffected.length > 0)
            }
            onClick={() => {
              void handleAddSelectedToPo();
            }}
            className="rounded-xl bg-tbc-red px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-tbc-red-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? "Adding to cart..."
              : `Add selected to PO (${selectedRows.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
