"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PoStatusBadge } from "@/components/po/po-status-badge";
import {
  getApproveBlockReason,
  type UserRole,
} from "@/lib/auth/role-guards";
import { formatCurrencyUSD, formatDateTime, formatNumber } from "@/lib/format";
import { canTransition } from "@/lib/po/approval";
import type {
  PurchaseOrderListItem,
  PurchaseOrderListLineSummary,
} from "@/lib/types";

type PoListCardProps = {
  order: PurchaseOrderListItem;
  userRole: UserRole;
  userEmail: string;
};

const iconButtonClassName =
  "flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B7280] transition-colors hover:border-[#CC2B2B] hover:text-[#CC2B2B] disabled:cursor-not-allowed disabled:opacity-60";

function formatLineSummary(lines: PurchaseOrderListLineSummary[]): {
  text: string;
  title: string;
} {
  if (lines.length === 0) {
    return { text: "No line items", title: "No line items" };
  }

  const parts = lines.map(
    (line) => `${formatNumber(line.quantity)} x ${line.productName}`
  );
  const full = parts.join(", ");

  if (lines.length === 1) {
    return { text: full, title: full };
  }

  if (lines.length <= 3) {
    return { text: full, title: full };
  }

  const more = lines.length - 1;
  const text = `${lines[0].productName} +${more} more items`;
  return { text, title: full };
}

export function PoListCard({ order, userRole, userEmail }: PoListCardProps) {
  const router = useRouter();
  const [status, setStatus] = useState(order.status);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setStatus(order.status);
  }, [order.status]);

  const approveBlockReason = getApproveBlockReason(
    userRole,
    userEmail,
    order.createdBy
  );

  const canSuppress = canTransition(status, "suppressed");
  const pdfUrl = `/api/purchase-orders/${order.id}/pdf`;
  const normalizedStatus = status.trim().toLowerCase();
  const canReviewAndApprove =
    normalizedStatus === "pending_approval" && !approveBlockReason;

  const metaParts = [
    order.supplierName?.trim() || "Supplier not specified",
    order.poDate ? formatDateTime(order.poDate) : null,
    order.createdBy ? `Raised by ${order.createdBy}` : null,
  ].filter((part): part is string => Boolean(part));

  const lineSummary = formatLineSummary(order.lines);
  const countsLabel = `${formatNumber(order.lineCount)} items - ${formatNumber(order.totalUnits)} units`;

  async function runTransition(toStatus: "pending_approval" | "suppressed") {

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

  async function sendToSupplier() {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/purchase-orders/${order.id}/send`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to send purchase order");
      }
      setStatus("sent");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send purchase order");
    } finally {
      setIsSubmitting(false);
    }
  }

  const primaryAction = (() => {
    if (normalizedStatus === "draft") {
      return (
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            void runTransition("pending_approval");
          }}
          className="h-9 rounded-lg bg-[#CC2B2B] px-3 text-sm font-medium text-white transition-colors hover:bg-[#B02626] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "…" : "Send for approval"}
        </button>
      );
    }
    if (normalizedStatus === "pending_approval") {
      if (canReviewAndApprove) {
        return (
          <Link
            href={`/purchase-orders/${order.id}`}
            className="inline-flex h-9 items-center rounded-lg bg-[#CC2B2B] px-3 text-sm font-medium text-white transition-colors hover:bg-[#B02626]"
          >
            Review and approve
          </Link>
        );
      }
      return (
        <Link
          href={`/purchase-orders/${order.id}`}
          className="inline-flex h-9 items-center rounded-lg bg-[#374151] px-3 text-sm font-medium text-white transition-colors hover:bg-[#1F2937]"
        >
          View status
        </Link>
      );
    }
    if (normalizedStatus === "approved") {
      return (
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            void sendToSupplier();
          }}
          className="h-9 rounded-lg bg-[#CC2B2B] px-3 text-sm font-medium text-white transition-colors hover:bg-[#B02626] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Sending…" : "Send to supplier"}
        </button>
      );
    }
    return (
      <Link
        href={`/purchase-orders/${order.id}`}
        className="inline-flex h-9 items-center rounded-lg bg-[#374151] px-3 text-sm font-medium text-white transition-colors hover:bg-[#1F2937]"
      >
        View PO
      </Link>
    );
  })();

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
        <p
          className="mt-1 truncate text-xs text-[#374151]"
          title={lineSummary.title}
        >
          {lineSummary.text}
        </p>
        <p className="mt-0.5 text-[10px] text-[#9CA3AF]">{countsLabel}</p>
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
        {order.hasUnknownLineCosts && order.unpricedLineCount > 0 ? (
          <p className="mt-0.5 text-[10px] text-[#9CA3AF]">
            Price not on file for {formatNumber(order.unpricedLineCount)} line
            {order.unpricedLineCount === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      <div className="mt-0 flex flex-shrink-0 flex-wrap items-center gap-2 max-sm:mt-3 max-sm:w-full">
        {primaryAction}
        <div className="relative">
          <button
            type="button"
            aria-label={`More actions for ${order.poNumber}`}
            onClick={() => setMenuOpen((open) => !open)}
            className={iconButtonClassName}
          >
            <i className="ti ti-dots-vertical text-base" aria-hidden="true" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-10 z-20 min-w-[11rem] rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-card">
              <a
                href={pdfUrl}
                className="block px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB]"
              >
                Download PDF
              </a>
              {canSuppress ? (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setMenuOpen(false);
                    void runTransition("suppressed");
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-60"
                >
                  Suppress PO
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

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
