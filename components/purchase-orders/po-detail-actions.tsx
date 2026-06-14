"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatCurrencyJMD, formatDateTime } from "@/lib/format";
import type { PurchaseOrderDocument } from "@/lib/types";

type PoDetailActionsProps = {
  purchaseOrder: PurchaseOrderDocument;
};

function getStatusBadgeClasses(status: string): string {
  if (status === "sent") {
    return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  }

  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export function PoDetailActions({ purchaseOrder }: PoDetailActionsProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(purchaseOrder.status);
  const [sentAt, setSentAt] = useState(purchaseOrder.sentAt ?? null);

  const pdfUrl = `/api/purchase-orders/${purchaseOrder.id}/pdf`;
  const canSend = status !== "sent" && Boolean(purchaseOrder.supplierEmail);

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
      <section className="rounded-2xl border border-transparent shadow-card bg-white p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-900">
                {purchaseOrder.poNumber}
              </h2>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${getStatusBadgeClasses(status)}`}
              >
                {status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Supplier:{" "}
              {purchaseOrder.supplierName ??
                purchaseOrder.supplierExternalId ??
                "Supplier not specified"}
            </p>
            <p className="text-sm text-slate-600">
              Date: {formatDateTime(purchaseOrder.poDate)}
            </p>
            {sentAt ? (
              <p className="text-sm text-slate-600">
                Sent: {formatDateTime(sentAt)}
              </p>
            ) : null}
            <p className="mt-2 text-sm font-medium text-slate-900">
              Total:{" "}
              {purchaseOrder.hasUnknownLineCosts
                ? `Partial total (some costs unavailable): ${formatCurrencyJMD(purchaseOrder.totalAmount)}`
                : formatCurrencyJMD(purchaseOrder.totalAmount)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={pdfUrl}
              className="rounded-2xl border border-transparent shadow-card bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Download PDF
            </a>
            {canSend ? (
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
              >
                Send Email
              </button>
            ) : status === "sent" ? null : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                No email on file.{" "}
                <Link
                  href="/reference-data"
                  className="font-medium text-accent hover:text-accent-hover"
                >
                  Add via Reference Data
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorMessage}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-transparent shadow-card bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  SKU
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Description
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Vendor item #
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">
                  Qty
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">
                  Unit cost
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">
                  Line total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchaseOrder.lines.map((line) => (
                <tr key={line.sku}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {line.sku}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {line.description ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {line.vendorItemNumber ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {line.quantityOrdered}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {formatCurrencyJMD(line.unitCost)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {formatCurrencyJMD(line.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {purchaseOrder.memo ? (
        <section className="rounded-2xl border border-transparent shadow-card bg-white p-6 shadow-card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Memo
          </h3>
          <p className="mt-2 text-sm text-slate-700">{purchaseOrder.memo}</p>
        </section>
      ) : null}

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-transparent shadow-card bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-slate-900">
              Send purchase order email?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This will email PO {purchaseOrder.poNumber} with PDF attached to:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {purchaseOrder.supplierEmail ? (
                <li>{purchaseOrder.supplierEmail}</li>
              ) : null}
            </ul>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-2xl border border-transparent shadow-card bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSendEmail}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
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
