"use client";

import Link from "next/link";
import { Download, Eye, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { getPoStatusBadgeVariant, getPoStatusLabel } from "@/lib/po-status-ui";
import type { PurchaseOrderListItem } from "@/lib/types";

type PoListRowActionsProps = {
  order: PurchaseOrderListItem;
};

const iconButtonClassName =
  "inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-transparent shadow-card bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export function PoListRowActions({ order }: PoListRowActionsProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState(order.status);
  const [isPending, startTransition] = useTransition();

  const pdfUrl = `/api/purchase-orders/${order.id}/pdf`;
  const canSend =
    status !== "sent" && Boolean(order.supplierEmail?.trim());

  function handleSendEmail() {
    setErrorMessage(null);

    startTransition(async () => {
      const response = await fetch(`/api/purchase-orders/${order.id}/send`, {
        method: "POST",
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErrorMessage(payload.error ?? "Failed to send purchase order email");
        return;
      }

      setStatus("sent");
      setShowConfirm(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Link
          href={`/purchase-orders/${order.id}`}
          className={iconButtonClassName}
          title="View purchase order"
          aria-label={`View ${order.poNumber}`}
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
        </Link>
        <a
          href={pdfUrl}
          className={iconButtonClassName}
          title="Download PDF"
          aria-label={`Download PDF for ${order.poNumber}`}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </a>
        {canSend ? (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={isPending}
            className={iconButtonClassName}
            title="Send email"
            aria-label={`Send ${order.poNumber} by email`}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <Modal
        open={showConfirm}
        onClose={() => {
          if (!isPending) {
            setShowConfirm(false);
            setErrorMessage(null);
          }
        }}
        ariaLabelledBy="po-send-title"
      >
        <h3 id="po-send-title" className="text-lg font-semibold text-slate-900">
          Send purchase order email?
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          This will email PO {order.poNumber} with PDF attached to:
        </p>
        <p className="mt-3 text-sm font-medium text-slate-900">
          {order.supplierEmail}
        </p>
        {errorMessage ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowConfirm(false)}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSendEmail}
            disabled={isPending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {isPending ? "Sending..." : "Confirm send"}
          </button>
        </div>
      </Modal>
    </>
  );
}

export function PoListStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={getPoStatusBadgeVariant(status)}>
      {getPoStatusLabel(status)}
    </Badge>
  );
}
