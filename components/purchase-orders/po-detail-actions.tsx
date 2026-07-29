"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { PoStatusBadge } from "@/components/po/po-status-badge";
import { PoTransitionButtons } from "@/components/po/po-transition-buttons";
import type { UserRole } from "@/lib/auth/role-guards";
import { formatCurrencyUSD, formatDateTime, formatNumber } from "@/lib/format";
import type { PurchaseOrderDocument } from "@/lib/types";

type PoDetailActionsProps = {
  purchaseOrder: PurchaseOrderDocument;
  userRole: UserRole;
  userEmail: string;
};

const iconButtonClassName =
  "flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B7280] transition-colors hover:border-[#CC2B2B] hover:text-[#CC2B2B] disabled:cursor-not-allowed disabled:opacity-60";

export function PoDetailActions({
  purchaseOrder,
  userRole,
  userEmail,
}: PoDetailActionsProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(purchaseOrder.status);
  const [sentAt, setSentAt] = useState(purchaseOrder.sentAt ?? null);
  const [submittedBanner, setSubmittedBanner] = useState<string | null>(null);

  useEffect(() => {
    setStatus(purchaseOrder.status);
    setSentAt(purchaseOrder.sentAt ?? null);
  }, [purchaseOrder.status, purchaseOrder.sentAt]);

  const pdfUrl = `/api/purchase-orders/${purchaseOrder.id}/pdf`;
  const canSend = status === "approved" && Boolean(purchaseOrder.supplierEmail);

  const metaParts = [
    purchaseOrder.supplierName?.trim() ||
      purchaseOrder.supplierExternalId ||
      "Supplier not specified",
    formatDateTime(purchaseOrder.poDate),
    sentAt ? `Sent ${formatDateTime(sentAt)}` : null,
    purchaseOrder.createdBy ? `Raised by ${purchaseOrder.createdBy}` : null,
  ].filter((part): part is string => Boolean(part));

  function handleSendEmail() {
    setErrorMessage(null);

    startTransition(async () => {
      const response = await fetch(
        `/api/purchase-orders/${purchaseOrder.id}/send`,
        { method: "POST" }
      );

      const payload = (await response.json()) as {
        error?: string;
        sentAt?: string;
      };

      if (!response.ok) {
        setErrorMessage(payload.error ?? "Failed to send purchase order email");
        return;
      }

      setStatus("sent");
      setSentAt(payload.sentAt ?? new Date().toISOString());
      setShowConfirm(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {submittedBanner ? (
        <div
          role="status"
          className="rounded-2xl border border-[#86EFAC] bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]"
        >
          {submittedBanner} sent for approval
        </div>
      ) : null}
      <section className="flex flex-wrap items-center gap-6 rounded-2xl bg-white px-6 py-4 shadow-card">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h2 className="truncate font-mono text-base font-bold text-[#111111]">
              {purchaseOrder.poNumber}
            </h2>
            <PoStatusBadge status={status} />
          </div>
          <p className="mt-1 truncate text-xs text-[#6B7280]">
            {metaParts.join(" · ")}
          </p>
        </div>

        <div className="shrink-0 pr-2 text-right">
          <p className="text-[10px] uppercase tracking-widest text-[#9CA3AF]">
            ORDER VALUE
          </p>
          <p className="text-lg font-bold text-[#111111]">
            {formatCurrencyUSD(purchaseOrder.totalAmount)}
          </p>
          {purchaseOrder.hasUnknownLineCosts &&
          purchaseOrder.unpricedLineCount > 0 ? (
            <p className="mt-0.5 text-[10px] text-[#9CA3AF]">
              Price not on file for{" "}
              {formatNumber(purchaseOrder.unpricedLineCount)} line
              {purchaseOrder.unpricedLineCount === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>

        <div className="mt-0 flex shrink-0 flex-wrap items-center gap-2 max-sm:mt-3 max-sm:w-full">
          <PoTransitionButtons
            poId={purchaseOrder.id}
            status={status}
            userRole={userRole}
            userEmail={userEmail}
            createdBy={purchaseOrder.createdBy}
            layout="toolbar"
            onTransitionSuccess={({ status: nextStatus, poNumber, toStatus }) => {
              setStatus(nextStatus);
              if (toStatus === "pending_approval") {
                setSubmittedBanner(poNumber);
              }
            }}
          />

          <a
            href={pdfUrl}
            title="Download PDF"
            aria-label={`Download PDF for ${purchaseOrder.poNumber}`}
            className={iconButtonClassName}
          >
            <i className="ti ti-download text-base" aria-hidden="true" />
          </a>

          {canSend ? (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={isPending}
              title="Send email"
              aria-label={`Send ${purchaseOrder.poNumber} by email`}
              className={iconButtonClassName}
            >
              <i className="ti ti-mail text-base" aria-hidden="true" />
            </button>
          ) : null}

          {status === "approved" && !purchaseOrder.supplierEmail ? (
            <Link
              href="/reference-data"
              className="text-xs font-medium text-[#CC2B2B] hover:underline"
            >
              Add supplier email
            </Link>
          ) : null}
        </div>
      </section>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-xl border border-[#FCA5A5] bg-[#FDF2F2] px-4 py-3 text-sm text-[#CC2B2B]"
        >
          {errorMessage}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#E5E7EB] text-sm">
            <thead className="bg-[#F9FAFB]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[#6B7280]">
                  SKU
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#6B7280]">
                  Description
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#6B7280]">
                  Vendor item #
                </th>
                <th className="px-4 py-3 text-right font-medium text-[#6B7280]">
                  Qty
                </th>
                <th className="px-4 py-3 text-right font-medium text-[#6B7280]">
                  Unit cost
                </th>
                <th className="px-4 py-3 text-right font-medium text-[#6B7280]">
                  Line total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {purchaseOrder.lines.map((line) => (
                <tr key={line.sku}>
                  <td className="px-4 py-3 font-medium text-[#111111]">
                    {line.sku}
                  </td>
                  <td className="px-4 py-3 text-[#374151]">
                    {line.description ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-[#374151]">
                    {line.vendorItemNumber ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-[#374151]">
                    {line.quantityOrdered}
                  </td>
                  <td className="px-4 py-3 text-right text-[#374151]">
                    {formatCurrencyUSD(line.unitCost)}
                  </td>
                  <td className="px-4 py-3 text-right text-[#374151]">
                    {formatCurrencyUSD(line.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {purchaseOrder.memo ? (
        <section className="rounded-2xl bg-white p-6 shadow-card">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
            Memo
          </h3>
          <p className="mt-2 text-sm text-[#374151]">{purchaseOrder.memo}</p>
        </section>
      ) : null}

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/30 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-[#111111]">
              Send purchase order email?
            </h3>
            <p className="mt-2 text-sm text-[#6B7280]">
              This will email PO {purchaseOrder.poNumber} with PDF attached to:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#374151]">
              {purchaseOrder.supplierEmail ? (
                <li>{purchaseOrder.supplierEmail}</li>
              ) : null}
            </ul>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSendEmail}
                className="rounded-xl bg-[#CC2B2B] px-4 py-2 text-sm font-medium text-white hover:bg-[#B02626] disabled:opacity-60"
              >
                {isPending ? "Sending..." : "Confirm send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
