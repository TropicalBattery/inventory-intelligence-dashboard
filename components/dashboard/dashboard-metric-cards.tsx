import { formatCurrencyJMD, formatNumber } from "@/lib/format";

type DashboardMetricCardsProps = {
  totalSkus: number;
  totalInventoryValue: number;
  itemsBelowReorderLevel: number;
  criticalCount: number;
};

type MetricCardConfig = {
  label: string;
  value: string;
  valueClassName?: string;
  iconClass: string;
  iconBg: string;
  iconColor: string;
  trend: {
    direction: "up" | "down" | "neutral";
    label: string;
  };
};

function getMetricValueSizeClass(value: string): string {
  const length = value.length;

  if (length > 18) {
    return "text-sm sm:text-base xl:text-base";
  }

  if (length > 14) {
    return "text-base sm:text-lg xl:text-lg";
  }

  if (length > 10) {
    return "text-lg sm:text-xl xl:text-2xl";
  }

  if (length > 6) {
    return "text-xl sm:text-2xl";
  }

  return "text-3xl";
}

function MetricCard({
  label,
  value,
  valueClassName = "text-[#111111]",
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
    <div className="min-w-0 rounded-2xl bg-white p-6 shadow-card">
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
        className={`mt-3 min-w-0 font-bold tabular-nums leading-tight tracking-tight ${getMetricValueSizeClass(value)} ${valueClassName}`}
      >
        {value}
      </p>
      <div
        className={`mt-2 flex items-center gap-1 text-xs font-medium ${trendClassName}`}
      >
        <i className={`ti ${trendIcon} text-[14px]`} aria-hidden="true" />
        <span>{trend.label}</span>
      </div>
    </div>
  );
}

export function DashboardMetricCards({
  totalSkus,
  totalInventoryValue,
  itemsBelowReorderLevel,
  criticalCount,
}: DashboardMetricCardsProps) {
  const cards: MetricCardConfig[] = [
    {
      label: "Total SKUs",
      value: formatNumber(totalSkus),
      iconClass: "ti-package",
      iconBg: "bg-tbc-red-light",
      iconColor: "text-tbc-red",
      trend: { direction: "neutral", label: "Active catalog" },
    },
    {
      label: "Inventory Value (J$)",
      value: formatCurrencyJMD(totalInventoryValue),
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
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} />
      ))}
    </div>
  );
}
