import Link from "next/link";
import { formatNumber } from "@/lib/format";
import type { ExceptionSummary } from "@/lib/exceptions/detect";

type DashboardExceptionsCardProps = {
  summary: ExceptionSummary;
};

function safeCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

export function DashboardExceptionsCard({
  summary,
}: DashboardExceptionsCardProps) {
  const totalSkus = safeCount(summary.totalSkus);
  const lines = [
    {
      key: "negative",
      count: safeCount(summary.negativeStock),
      label: "negative stock",
      className: "text-[#CC2B2B]",
    },
    {
      key: "supplier",
      count: safeCount(summary.missingSupplierData),
      label: "missing supplier data",
      className: "text-[#6B7280]",
    },
    {
      key: "stale",
      count: safeCount(summary.staleDemand),
      label: "stale demand",
      className: "text-[#6B7280]",
    },
  ].filter((line) => line.count > 0);

  return (
    <Link
      href="/exceptions"
      className="block min-w-0 rounded-2xl bg-white p-5 shadow-card transition-colors hover:bg-[#FAFAFA]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-xs font-medium uppercase tracking-wide text-[#6B7280]">
          Data Exceptions
        </p>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tbc-amber-light">
          <i
            className="ti ti-alert-octagon text-[20px] text-tbc-amber"
            aria-hidden="true"
          />
        </div>
      </div>
      <p
        className={`mt-3 truncate text-2xl font-bold leading-tight ${
          totalSkus > 0 ? "text-tbc-amber" : "text-[#16A34A]"
        }`}
      >
        {formatNumber(totalSkus)}
      </p>
      <div className="mt-2 space-y-0.5">
        {totalSkus === 0 ? (
          <p className="text-xs text-[#6B7280]">All clear</p>
        ) : (
          lines.slice(0, 3).map((line) => (
            <p key={line.key} className={`text-xs ${line.className}`}>
              {formatNumber(line.count)} {line.label}
            </p>
          ))
        )}
      </div>
    </Link>
  );
}
