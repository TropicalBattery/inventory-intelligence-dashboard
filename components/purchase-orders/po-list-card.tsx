"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PoStatusBadge } from "@/components/po/po-status-badge";
import {
  getApproveBlockReason,
  type UserRole,
} from "@/lib/auth/role-guards";
import { formatCurrencyUSD, formatDateTime } from "@/lib/format";
import { canTransition } from "@/lib/po/approval";
import type { PurchaseOrderListItem } from "@/lib/types";

type PoListCardProps = {
  order: PurchaseOrderListItem;
  userRole: UserRole;
  userEmail: string;
};

const iconButtonClassName =
  "flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B7280] transition-colors hover:border-[#CC2B2B] hover:text-[#CC2B2B] disabled:cursor-not-allowed disabled:opacity-60";

export function PoListCard({ order, userRole, userEmail }: PoListCardProps) {
  const router = useRouter();
  const [status, setStatus] = useState(order.status);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(order.status);
  }, [order.status]);

  const approveBlockReason = getApproveBlockReason(
    userRole,
    userEmail,
    order.createdBy
  );

  const quick =
    status === "draft" && canTransition("draft", "pending_approval")
      ? { toStatus: "pending_approval" as const, label: "Submit for approval" }
      : status === "pending_approval" &&
          canTransition("pending_approval", "approved")
        ? { toStatus: "approved" as const, label: "Approve" }
        : null;

  const canSuppress = canTransition(status, "suppressed");
  const pdfUrl = `/api/purchase-orders/${order.id}/pdf`;
  const approveBlocked =
    quick?.toStatus === "approved" && Boolean(approveBlockReason);

  const metaParts = [
    order.supplierName?.trim() || "Supplier not specified",
    order.poDate ? formatDateTime(order.poDate) : null,
    order.createdBy ? `Raised by ${order.createdBy}` : null,
  ].filter((part): part is string => Boolean(part));

  async function runTransition(
    toStatus: "pending_approval" | "approved" | "suppressed"
  ) {
    if (toStatus === "approved" && approveBlockReason) {
      setError(approveBlockReason);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/purchase-orders/${encodeURIComponent(order.id)}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toStatus }),
        }
      );
      const data = (await response.json().catch(() => null)) as {
        status?: string;
        poNumber?: string;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Transition failed");
      }

      if (data?.status) {
        setStatus(data.status);
      }

      if (toStatus === "pending_approval") {
        const poNumber = data?.poNumber?.trim() || order.poNumber;
        router.replace(
          `/purchase-orders?submitted=${encodeURIComponent(poNumber)}`
        );
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className="flex flex-wrap items-center gap-6 rounded-2xl bg-white px-6 py-4 shadow-card">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <p className="truncate font-mono text-base font-bold text-[#111111]">
            {order.poNumber}
          </p>
          <PoStatusBadge status={status} />
        </div>
        <p className="mt-1 truncate text-xs text-[#6B7280]">
          {metaParts.join(" · ")}
        </p>
        {error ? (
          <p className="mt-1 text-[10px] text-[#CC2B2B]" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 pr-2 text-right">
        <p className="text-[10px] uppercase tracking-widest text-[#9CA3AF]">
          ORDER VALUE
        </p>
        <p className="text-lg font-bold text-[#111111]">
          {formatCurrencyUSD(order.totalAmount)}
        </p>
      </div>

      <div className="mt-0 flex flex-shrink-0 flex-wrap items-center gap-2 max-sm:mt-3 max-sm:w-full">
        {quick ? (
          <button
            type="button"
            disabled={isSubmitting || approveBlocked}
            title={approveBlocked ? approveBlockReason ?? undefined : undefined}
            onClick={() => {
              void runTransition(quick.toStatus);
            }}
            className="h-9 rounded-lg bg-[#CC2B2B] px-3 text-sm font-medium text-white transition-colors hover:bg-[#B02626] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "…" : quick.label}
          </button>
        ) : null}

        {canSuppress ? (
          <button
            type="button"
            disabled={isSubmitting}
            title="Suppress"
            aria-label={`Suppress ${order.poNumber}`}
            onClick={() => {
              void runTransition("suppressed");
            }}
            className={iconButtonClassName}
          >
            <i className="ti ti-ban text-base" aria-hidden="true" />
          </button>
        ) : null}

        <a
          href={pdfUrl}
          title="Download PDF"
          aria-label={`Download PDF for ${order.poNumber}`}
          className={iconButtonClassName}
        >
          <i className="ti ti-download text-base" aria-hidden="true" />
        </a>

        <Link
          href={`/purchase-orders/${order.id}`}
          title="View purchase order"
          aria-label={`View ${order.poNumber}`}
          className={`${iconButtonClassName} text-[#9CA3AF]`}
        >
          <i className="ti ti-chevron-right text-base" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
