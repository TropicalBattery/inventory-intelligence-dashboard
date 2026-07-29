import { formatCurrencyUSD, formatNumber } from "@/lib/format";
import type { ApprovedMetrics } from "@/lib/queries/purchase-orders";
import type { PurchaseOrderListItem } from "@/lib/types";

type PoSummaryCardsProps = {
  orders: PurchaseOrderListItem[];
  approvedMetrics: ApprovedMetrics;
};

type PoListSummary = {
  draftCount: number;
  awaitingApprovalCount: number;
};

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase();
}

function isDraftStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "draft";
}

function isAwaitingApproval(status: string): boolean {
  const normalized = normalizeStatus(status);
  return normalized === "pending_approval";
}

export function computePoListSummary(
  orders: PurchaseOrderListItem[]
): PoListSummary {
  let draftCount = 0;
  let awaitingApprovalCount = 0;

  for (const order of orders) {
    if (isDraftStatus(order.status)) {
      draftCount += 1;
    }
    if (isAwaitingApproval(order.status)) {
      awaitingApprovalCount += 1;
    }
  }

  return {
    draftCount,
    awaitingApprovalCount,
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

export function PoSummaryCards({ orders, approvedMetrics }: PoSummaryCardsProps) {
  const summary = computePoListSummary(orders);

  return (
    <div className="mb-5 grid grid-cols-4 gap-5">
      <SummaryCard
        label="Draft POs"
        value={formatNumber(summary.draftCount)}
        subLabel="Saved drafts awaiting submission"
        iconClass="ti-receipt"
        iconBg="bg-tbc-red-light"
        iconColor="text-tbc-red"
      />
      <SummaryCard
        label="Awaiting approval"
        value={formatNumber(summary.awaitingApprovalCount)}
        subLabel="Pending approver decision"
        iconClass="ti-hourglass"
        iconBg="bg-tbc-amber-light"
        iconColor="text-tbc-amber"
      />
      <SummaryCard
        label="Approved this month"
        value={formatNumber(approvedMetrics.approvedThisMonthCount)}
        subLabel="Based on approval audit events"
        iconClass="ti-check"
        iconBg="bg-[#ECFDF5]"
        iconColor="text-[#047857]"
      />
      <SummaryCard
        label="Approved value this month"
        value={formatCurrencyUSD(approvedMetrics.approvedValueThisMonth)}
        subLabel="Value of approved orders this month"
        iconClass="ti-clock"
        iconBg="bg-[#E6F1FB]"
        iconColor="text-[#185FA5]"
      />
    </div>
  );
}
