import { formatCurrencyUSD, formatNumber } from "@/lib/format";
import type { PurchaseOrderListItem } from "@/lib/types";

type PoSummaryCardsProps = {
  orders: PurchaseOrderListItem[];
};

type PoListSummary = {
  monthTotal: number;
  monthOrderCount: number;
  allTimeTotal: number;
  pendingCount: number;
};

function amountOrZero(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0;
  }

  return value;
}

function isInCurrentCalendarMonth(poDate: string | null): boolean {
  if (!poDate) {
    return false;
  }

  const parsed = new Date(poDate);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const now = new Date();
  return (
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth()
  );
}

function isPendingStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "draft" || normalized === "pending_approval";
}

export function computePoListSummary(
  orders: PurchaseOrderListItem[]
): PoListSummary {
  let monthTotal = 0;
  let monthOrderCount = 0;
  let allTimeTotal = 0;
  let pendingCount = 0;

  for (const order of orders) {
    const amount = amountOrZero(order.totalAmount);
    allTimeTotal += amount;

    if (isInCurrentCalendarMonth(order.poDate)) {
      monthTotal += amount;
      monthOrderCount += 1;
    }

    if (isPendingStatus(order.status)) {
      pendingCount += 1;
    }
  }

  return {
    monthTotal,
    monthOrderCount,
    allTimeTotal,
    pendingCount,
  };
}

type SummaryCardProps = {
  label: string;
  value: string;
  subLabel: string;
  iconClass: string;
  iconBg: string;
  iconColor: string;
};

function SummaryCard({
  label,
  value,
  subLabel,
  iconClass,
  iconBg,
  iconColor,
}: SummaryCardProps) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-xs font-medium uppercase tracking-wide text-[#6B7280]">
          {label}
        </p>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}
        >
          <i
            className={`ti ${iconClass} text-[20px] ${iconColor}`}
            aria-hidden="true"
          />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums leading-tight tracking-tight text-[#111111]">
        {value}
      </p>
      <p className="mt-2 text-xs text-[#6B7280]">{subLabel}</p>
    </div>
  );
}

export function PoSummaryCards({ orders }: PoSummaryCardsProps) {
  const summary = computePoListSummary(orders);

  return (
    <div className="mb-5 grid grid-cols-3 gap-5">
      <SummaryCard
        label="Total PO Value (This Month)"
        value={formatCurrencyUSD(summary.monthTotal)}
        subLabel={`${formatNumber(summary.monthOrderCount)} orders this month`}
        iconClass="ti-receipt"
        iconBg="bg-tbc-red-light"
        iconColor="text-tbc-red"
      />
      <SummaryCard
        label="Total PO Value (All Time)"
        value={formatCurrencyUSD(summary.allTimeTotal)}
        subLabel="All purchase orders (US$)"
        iconClass="ti-currency-dollar"
        iconBg="bg-tbc-amber-light"
        iconColor="text-tbc-amber"
      />
      <SummaryCard
        label="Pending Orders"
        value={formatNumber(summary.pendingCount)}
        subLabel="Draft or pending approval"
        iconClass="ti-clock"
        iconBg="bg-[#E6F1FB]"
        iconColor="text-[#185FA5]"
      />
    </div>
  );
}
