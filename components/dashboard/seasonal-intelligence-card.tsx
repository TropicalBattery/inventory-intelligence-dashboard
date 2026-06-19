"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  DEFAULT_VISIBLE_CATEGORY_COUNT,
  formatCategorySubtitle,
  getCategoryActionIconClass,
  getCategoryActionState,
  getCategoryActionText,
  getOrderWindowMonths,
  MONTH_ABBREVIATIONS,
  sortSeasonalCategories,
} from "@/lib/seasonality/category-display";
import type {
  SeasonalCategoryInsight,
  SeasonalIntelligenceRecord,
  SeasonalityStrength,
} from "@/lib/seasonality/types";
import {
  buildDemandDriverDescription,
  buildDemandDrivers,
  getDemandDriverOrderHint,
} from "@/lib/seasonality/summary-display";
import { formatDateTime } from "@/lib/format";

type SeasonalIntelligenceCardProps = {
  initialRecord: SeasonalIntelligenceRecord | null;
};

function SeasonalSummarySection({
  categories,
}: {
  categories: SeasonalCategoryInsight[];
}) {
  const demandDrivers = useMemo(
    () => buildDemandDrivers(categories),
    [categories]
  );

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {demandDrivers.map((driver) => (
          <div
            key={driver.id}
            className="rounded-[var(--border-radius-md)] bg-[var(--color-background-secondary)] px-[13px] py-[11px]"
          >
            <div className="mb-1.5 flex items-start gap-2">
              <span aria-hidden="true">{driver.emoji}</span>
              <p className="text-xs font-medium text-[var(--color-text-primary)]">
                {driver.title}
              </p>
            </div>
            <p className="text-[11px] leading-[1.55] text-[var(--color-text-secondary)]">
              {buildDemandDriverDescription(
                driver,
                getDemandDriverOrderHint(driver.id)
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--color-border-tertiary)] pt-3">
        <p className="text-[11px] leading-normal text-[var(--color-text-secondary)]">
          With a 93-day lead time, no order can be reactive. All replenishment
          must be planned a full quarter in advance.
        </p>
      </div>
    </div>
  );
}

function SeasonalLegend() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 text-[11px] text-[var(--color-text-secondary)]">
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-3 w-3 rounded-[2px] bg-[var(--seasonal-peak-bg)]"
          aria-hidden="true"
        />
        Peak month
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-3 w-3 rounded-[2px] bg-[var(--seasonal-order-bg)]"
          aria-hidden="true"
        />
        Order window
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-3 w-3 rounded-[2px] border-2 border-[var(--seasonal-today-outline)] bg-[var(--color-background-secondary)]"
          aria-hidden="true"
        />
        Today
      </span>
    </div>
  );
}

function StrengthBadge({ strength }: { strength: SeasonalityStrength }) {
  if (strength === "high") {
    return (
      <span className="rounded-full border border-[#FCA5A5] bg-[#FDF2F2] px-2.5 py-0.5 text-[11px] font-semibold text-[#CC2B2B]">
        High
      </span>
    );
  }

  return (
    <span className="rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-0.5 text-[11px] font-semibold text-[#B45309]">
      Moderate
    </span>
  );
}

function MonthTimeline({
  category,
  currentMonth,
}: {
  category: SeasonalCategoryInsight;
  currentMonth: number;
}) {
  const orderWindowMonths = getOrderWindowMonths(category.peak_months);

  return (
    <div className="mb-3 flex flex-wrap gap-1">
      {MONTH_ABBREVIATIONS.map((label, index) => {
        const monthNum = index + 1;
        const isPeak = category.peak_months.includes(monthNum);
        const isOrderWindow = orderWindowMonths.includes(monthNum);
        const isToday = monthNum === currentMonth;

        return (
          <div
            key={label}
            title={label}
            className={[
              "flex h-[26px] w-[26px] items-center justify-center rounded text-[9px] font-medium",
              isPeak
                ? "bg-[var(--seasonal-peak-bg)] text-[var(--seasonal-peak-text)]"
                : isOrderWindow
                  ? "bg-[var(--seasonal-order-bg)] text-[var(--seasonal-order-text)]"
                  : "bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]",
              isToday
                ? "ring-2 ring-[var(--seasonal-today-outline)] ring-inset"
                : "",
            ].join(" ")}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

function SeasonalCategoryCard({
  category,
  referenceDate,
}: {
  category: SeasonalCategoryInsight;
  referenceDate: Date;
}) {
  const currentMonth = referenceDate.getMonth() + 1;
  const actionState = getCategoryActionState(category, referenceDate);

  return (
    <article className="rounded-[var(--border-radius-md)] border border-[var(--color-border-tertiary)] bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
            {category.item_class}
          </h3>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
            {formatCategorySubtitle(category)}
          </p>
        </div>
        <StrengthBadge strength={category.strength} />
      </div>

      <MonthTimeline category={category} currentMonth={currentMonth} />

      <p className="mb-2.5 text-xs leading-[1.55] text-[var(--color-text-secondary)]">
        {category.reason}
      </p>

      <div className="flex items-start gap-2 rounded-[var(--border-radius-md)] border border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] px-2.5 py-2 text-xs text-[var(--color-text-primary)]">
        <i
          className={`ti ${getCategoryActionIconClass(actionState)} mt-0.5 shrink-0 text-sm`}
          aria-hidden="true"
        />
        <span>{getCategoryActionText(actionState)}</span>
      </div>
    </article>
  );
}

function SeasonalCategoriesList({
  categories,
}: {
  categories: SeasonalCategoryInsight[];
}) {
  const [expanded, setExpanded] = useState(false);
  const extraRef = useRef<HTMLDivElement>(null);
  const [extraMaxHeight, setExtraMaxHeight] = useState(0);
  const referenceDate = useMemo(() => new Date(), []);
  const sortedCategories = useMemo(
    () => sortSeasonalCategories(categories, referenceDate),
    [categories, referenceDate]
  );

  const visibleCategories = sortedCategories.slice(
    0,
    DEFAULT_VISIBLE_CATEGORY_COUNT
  );
  const hiddenCategories = sortedCategories.slice(
    DEFAULT_VISIBLE_CATEGORY_COUNT
  );
  const hiddenCount = hiddenCategories.length;

  useEffect(() => {
    if (!extraRef.current) {
      return;
    }

    setExtraMaxHeight(extraRef.current.scrollHeight);
  }, [expanded, hiddenCategories]);

  if (sortedCategories.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        No high or moderate seasonal categories were identified in the latest
        analysis.
      </p>
    );
  }

  return (
    <div>
      <SeasonalLegend />

      <div className="space-y-3">
        {visibleCategories.map((category) => (
          <SeasonalCategoryCard
            key={`${category.item_class}-${category.peak_months.join("-")}`}
            category={category}
            referenceDate={referenceDate}
          />
        ))}
      </div>

      {hiddenCount > 0 ? (
        <>
          <div
            className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
            style={{ maxHeight: expanded ? extraMaxHeight : 0 }}
          >
            <div ref={extraRef} className="mt-3 space-y-3">
              {hiddenCategories.map((category) => (
                <SeasonalCategoryCard
                  key={`${category.item_class}-${category.peak_months.join("-")}-extra`}
                  category={category}
                  referenceDate={referenceDate}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--border-radius-md)] border border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] px-2.5 py-2.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border-tertiary)]/20"
          >
            <i
              className={`ti ${expanded ? "ti-chevron-up" : "ti-chevron-down"} text-sm`}
              aria-hidden="true"
            />
            {expanded
              ? "Show less"
              : `Show ${hiddenCount} more categor${hiddenCount === 1 ? "y" : "ies"}`}
          </button>
        </>
      ) : null}
    </div>
  );
}

export function SeasonalIntelligenceCard({
  initialRecord,
}: SeasonalIntelligenceCardProps) {
  const [record, setRecord] = useState(initialRecord);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setRecord(initialRecord);
  }, [initialRecord]);

  function handleRefresh() {
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/analysis/seasonality", {
          method: "POST",
        });
        const payload = (await response.json()) as {
          record?: SeasonalIntelligenceRecord;
          error?: string;
        };

        if (!response.ok || !payload.record) {
          setErrorMessage(payload.error ?? "Failed to refresh seasonal analysis");
          return;
        }

        setRecord(payload.record);
      } catch {
        setErrorMessage("Failed to refresh seasonal analysis");
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#EFF6FF] p-2 text-[#1D4ED8]">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#111111]">
              Seasonal Intelligence
            </h2>
            <p className="mt-1 text-xs text-[#6B7280]">
              AI analysis of 13-month sales patterns by SKU and item class
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {isPending ? "Refreshing..." : "Refresh Analysis"}
        </button>
      </div>

      {errorMessage ? (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}

      {!record ? (
        <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F9FAFB] px-4 py-8 text-center">
          <p className="text-sm text-[#6B7280]">
            No seasonal analysis yet. Run Refresh Analysis to scan sales history
            and generate category guidance.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <SeasonalSummarySection categories={record.seasonal_categories} />
            <p className="mt-3 text-xs text-[#9CA3AF]">
              Last analysis: {formatDateTime(record.analysis_date)}
            </p>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
              Seasonal categories
            </p>
            <SeasonalCategoriesList categories={record.seasonal_categories} />
          </div>
        </div>
      )}
    </div>
  );
}
