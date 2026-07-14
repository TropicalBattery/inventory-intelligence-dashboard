import { DashboardExceptionsCard } from "@/components/dashboard/dashboard-exceptions-card";
import { formatCurrencyJMD, formatNumber } from "@/lib/format";
import type { ExceptionSummary } from "@/lib/exceptions/detect";

type DashboardMetricCardsProps = {
  totalSkus: number;
  activeWorkflowSkuCount: number | null;
  totalInventoryValue: number;
  itemsBelowReorderLevel: number;
  criticalCount: number;
  exceptionsSummary: ExceptionSummary;
};

type MetricCardConfig = {
  label: string;
  value: string;
  valueTitle?: string;
  valueClassName?: string;
  subline?: string;
  iconClass: string;
  iconBg: string;
  iconColor: string;
  trend: {
    direction: "up" | "down" | "neutral";
    label: string;
  };
};

/** Compact display for large J$ totals so 5-up cards stay one line. */
function formatInventoryValueMetric(value: number): {
  display: string;
  title?: string;
} {
  const full = formatCurrencyJMD(value);
  if (!Number.isFinite(value) || Math.abs(value) < 1_000_000_000) {
    return { display: full };
  }

  const billions = value / 1_000_000_000;
  const compact = `J$${billions.toLocaleString("en-JM", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}B`;

  return { display: compact, title: full };
}

function MetricCard({
  label,
  value,
  valueTitle,
  valueClassName = "text-[#111111]",
  subline,
  iconClass,
  iconBg,
  iconColor,
  trend,
}: MetricCardConfig) {
  const trendClassName =
    trend.direction === "up"
      ? "text-green-600"
      : trend.direction === "down"
        ? "text-red-600"
        : "text-[#6B7280]";

  const trendIcon =
    trend.direction === "up"
      ? "ti-trending-up"
      : trend.direction === "down"
        ? "ti-trending-down"
        : "ti-minus";

  return (
    <div className="min-w-0 rounded-2xl bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-xs font-medium uppercase tracking-wide text-[#6B7280]">
          {label}
        </p>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
        >
          <i
            className={`ti ${iconClass} text-[20px] ${iconColor}`}
            aria-hidden="true"
          />
        </div>
      </div>
      <p
        className={`mt-3 truncate text-2xl font-semibold leading-tight ${valueClassName}`}
        title={valueTitle}
      >
        {value}
      </p>
      {subline ? (
        <p className="mt-1 text-xs text-[#9CA3AF]">{subline}</p>
      ) : null}
      <p className={`mt-2 flex items-center gap-1 text-xs ${trendClassName}`}>
        <i className={`ti ${trendIcon} text-sm`} aria-hidden="true" />
        {trend.label}
      </p>
    </div>
  );
}

export function DashboardMetricCards({
  totalSkus,
  activeWorkflowSkuCount,
  totalInventoryValue,
  itemsBelowReorderLevel,
  criticalCount,
  exceptionsSummary,
}: DashboardMetricCardsProps) {
  const inventoryValue = formatInventoryValueMetric(totalInventoryValue);

  const cards: MetricCardConfig[] = [
    {
      label: "Total SKUs",
      value: formatNumber(totalSkus),
      subline:
        activeWorkflowSkuCount != null
          ? `${formatNumber(activeWorkflowSkuCount)} in active workflow`
          : undefined,
      iconClass: "ti-package",
      iconBg: "bg-tbc-red-light",
      iconColor: "text-tbc-red",
      trend: { direction: "neutral", label: "Active catalog" },
    },
    {
      label: "Inventory Value (J$)",
      value: inventoryValue.display,
      valueTitle: inventoryValue.title,
      iconClass: "ti-currency-dollar",
      iconBg: "bg-tbc-amber-light",
      iconColor: "text-tbc-amber",
      trend: { direction: "neutral", label: "Current valuation" },
    },
    {
      label: "Items Below Reorder",
      value: formatNumber(itemsBelowReorderLevel),
      valueClassName:
        itemsBelowReorderLevel > 0 ? "text-tbc-red" : "text-[#111111]",
      iconClass: "ti-alert-triangle",
      iconBg: "bg-tbc-red-light",
      iconColor: "text-tbc-red",
      trend: {
        direction: itemsBelowReorderLevel > 0 ? "down" : "up",
        label:
          itemsBelowReorderLevel > 0
            ? "Needs replenishment"
            : "All above reorder level",
      },
    },
    {
      label: "Critical Items",
      value: formatNumber(criticalCount),
      valueClassName: criticalCount > 0 ? "text-tbc-red" : "text-[#111111]",
      iconClass: "ti-circle-x",
      iconBg: "bg-tbc-red-light",
      iconColor: "text-tbc-red",
      trend: {
        direction: criticalCount > 0 ? "down" : "up",
        label:
          criticalCount > 0 ? "Immediate action required" : "No critical items",
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} />
      ))}
      <DashboardExceptionsCard summary={exceptionsSummary} />
    </div>
  );
}
