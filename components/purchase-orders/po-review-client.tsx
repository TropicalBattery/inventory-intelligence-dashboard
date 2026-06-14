"use client";

import Link from "next/link";
import { Download, Send, Sparkles } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { generatePoCoverNote } from "@/app/(main)/purchase-orders/ai-actions";
import { generatePurchaseOrder } from "@/app/(main)/purchase-orders/actions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatCurrencyJMD } from "@/lib/format";
import { sumKnownLineTotals } from "@/lib/po/line-cost";
import { getPoStatusBadgeVariant, getPoStatusLabel } from "@/lib/po-status-ui";
import type { PoLineInput, PoReviewSupplierGroup } from "@/lib/types";

type PoReviewClientProps = {
  batchId: string;
  supplierGroups: PoReviewSupplierGroup[];
};

type EditableLine = PoLineInput & {
  lineTotal: number | null;
};

type GeneratedPo = {
  id: string;
  status: string;
};

type EditableGroup = {
  supplierExternalId: string;
  supplierName: string | null;
  supplierEmail: string | null;
  supplierAddress: string | null;
  memo: string;
  lines: EditableLine[];
  generatedPo?: GeneratedPo;
};

const inlineQtyClassName =
  "w-20 rounded-md border border-slate-300 px-2 py-1 text-right text-sm focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20";

function toEditableGroups(groups: PoReviewSupplierGroup[]): EditableGroup[] {
  return groups.map((group) => ({
    supplierExternalId: group.supplierExternalId,
    supplierName: group.supplierName,
    supplierEmail: group.supplierEmail,
    supplierAddress: group.supplierAddress,
    memo: "",
    lines: group.lines.map((line) => ({ ...line })),
  }));
}

export function PoReviewClient({ batchId, supplierGroups }: PoReviewClientProps) {
  const [groups, setGroups] = useState<EditableGroup[]>(() =>
    toEditableGroups(supplierGroups)
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatingSupplierId, setGeneratingSupplierId] = useState<
    string | null
  >(null);
  const [generatingCoverNoteSupplierId, setGeneratingCoverNoteSupplierId] =
    useState<string | null>(null);
  const [sendConfirmSupplierId, setSendConfirmSupplierId] = useState<
    string | null
  >(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendingSupplierId, setSendingSupplierId] = useState<string | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const groupTotals = useMemo(
    () => groups.map((group) => sumKnownLineTotals(group.lines)),
    [groups]
  );

  const groupHasUnknownCosts = useMemo(
    () =>
      groups.map((group) =>
        group.lines.some((line) => line.unitCost === null)
      ),
    [groups]
  );

  const sendConfirmGroup = groups.find(
    (group) => group.supplierExternalId === sendConfirmSupplierId
  );

  function updateLineQuantity(
    supplierExternalId: string,
    sku: string,
    quantity: number
  ) {
    setGroups((current) =>
      current.map((group) => {
        if (group.supplierExternalId !== supplierExternalId) {
          return group;
        }

        return {
          ...group,
          lines: group.lines.map((line) => {
            if (line.sku !== sku) {
              return line;
            }

            const safeQuantity = Number.isFinite(quantity)
              ? Math.max(0, quantity)
              : 0;
            return {
              ...line,
              quantity: safeQuantity,
              lineTotal:
                line.unitCost === null
                  ? null
                  : safeQuantity * line.unitCost,
            };
          }),
        };
      })
    );
  }

  function updateMemo(supplierExternalId: string, memo: string) {
    setGroups((current) =>
      current.map((group) =>
        group.supplierExternalId === supplierExternalId
          ? { ...group, memo }
          : group
      )
    );
  }

  function handleGenerateCoverNote(group: EditableGroup, groupIndex: number) {
    setErrorMessage(null);
    setGeneratingCoverNoteSupplierId(group.supplierExternalId);

    startTransition(async () => {
      try {
        const totalValue = groupTotals[groupIndex] ?? 0;
        const result = await generatePoCoverNote({
          supplierName: group.supplierName ?? group.supplierExternalId,
          totalValue,
          hasUnknownCosts: groupHasUnknownCosts[groupIndex] ?? false,
          lines: group.lines.map((line) => ({
            sku: line.sku,
            name: line.name,
            quantity: line.quantity,
            unitCost: line.unitCost,
            lineTotal: line.lineTotal,
          })),
        });

        updateMemo(group.supplierExternalId, result.note);
      } catch {
        setErrorMessage("Could not generate cover note. Please try again.");
      } finally {
        setGeneratingCoverNoteSupplierId(null);
      }
    });
  }

  function handleGenerate(group: EditableGroup) {
    if (group.lines.length === 0) {
      setErrorMessage("Add at least one line item before generating a PO");
      return;
    }

    setErrorMessage(null);
    setGeneratingSupplierId(group.supplierExternalId);

    startTransition(async () => {
      const result = await generatePurchaseOrder({
        supplierExternalId: group.supplierExternalId,
        memo: group.memo.trim() || null,
        lines: group.lines.map((line) => ({
          sku: line.sku,
          productExternalId: line.productExternalId,
          name: line.name,
          vendorItemNumber: line.vendorItemNumber,
          quantity: line.quantity,
          unitCost: line.unitCost,
        })),
      });

      if (!result.success || !result.purchaseOrderId) {
        setErrorMessage(result.error ?? "Failed to generate purchase order");
        setGeneratingSupplierId(null);
        return;
      }

      setGroups((current) =>
        current.map((entry) =>
          entry.supplierExternalId === group.supplierExternalId
            ? {
                ...entry,
                generatedPo: {
                  id: result.purchaseOrderId!,
                  status: "draft",
                },
              }
            : entry
        )
      );
      setGeneratingSupplierId(null);
    });
  }

  function handleSendEmail(group: EditableGroup) {
    if (!group.generatedPo) {
      return;
    }

    setSendError(null);
    setSendingSupplierId(group.supplierExternalId);

    startTransition(async () => {
      const response = await fetch(
        `/api/purchase-orders/${group.generatedPo!.id}/send`,
        { method: "POST" }
      );

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setSendError(payload.error ?? "Failed to send purchase order email");
        setSendingSupplierId(null);
        return;
      }

      setGroups((current) =>
        current.map((entry) =>
          entry.supplierExternalId === group.supplierExternalId &&
          entry.generatedPo
            ? {
                ...entry,
                generatedPo: { ...entry.generatedPo, status: "sent" },
              }
            : entry
        )
      );
      setSendConfirmSupplierId(null);
      setSendingSupplierId(null);
    });
  }

  if (groups.length === 0) {
    return (
      <Card>
        <h2 className="text-xl font-semibold text-slate-900">
          Generate Purchase Orders
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          No draft items found for batch {batchId}.
        </p>
        <Link
          href="/reorder"
          className="mt-4 inline-flex text-sm font-medium text-accent hover:text-accent-hover"
        >
          Back to Reorder Recommendations
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {errorMessage ? (        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorMessage}
        </div>
      ) : null}

      {groups.map((group, groupIndex) => {
        const total = groupTotals[groupIndex] ?? 0;
        const isGenerated = Boolean(group.generatedPo);
        const canSend =
          isGenerated &&
          group.generatedPo?.status !== "sent" &&
          Boolean(group.supplierEmail?.trim());

        return (
          <Card key={group.supplierExternalId} className="p-0">
            <div className="border-b border-slate-200 px-6 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {group.supplierName ?? group.supplierExternalId}
                    </h3>
                    {group.generatedPo ? (
                      <Badge
                        variant={getPoStatusBadgeVariant(
                          group.generatedPo.status
                        )}
                      >
                        {getPoStatusLabel(group.generatedPo.status)}
                      </Badge>
                    ) : null}
                  </div>
                  {group.supplierEmail ? (
                    <p className="mt-1 text-sm text-slate-500">
                      {group.supplierEmail}
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="warning">No email on file</Badge>
                      <Link
                        href="/reference-data"
                        className="text-sm font-medium text-accent hover:text-accent-hover"
                      >
                        Add supplier email
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Table containerClassName="rounded-none border-0 shadow-none">
              <TableHeader>
                <TableRow className="hover:bg-slate-50">
                  <TableHead>SKU</TableHead>
                  <TableHead>Vendor item #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="text-right">Line total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.lines.map((line) => (
                  <TableRow key={line.sku}>
                    <TableCell className="font-medium text-slate-900">
                      {line.sku}
                    </TableCell>
                    <TableCell>{line.vendorItemNumber ?? "-"}</TableCell>
                    <TableCell className="max-w-[12rem] truncate">
                      {line.name ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {isGenerated ? (
                        line.quantity
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={line.quantity}
                          onChange={(event) =>
                            updateLineQuantity(
                              group.supplierExternalId,
                              line.sku,
                              Number(event.target.value)
                            )
                          }
                          className={inlineQtyClassName}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyJMD(line.unitCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrencyJMD(line.lineTotal)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 border-slate-300 hover:bg-white">
                  <TableCell
                    colSpan={5}
                    className="pt-2 text-right font-semibold text-slate-900"
                  >
                    Total:
                  </TableCell>
                  <TableCell className="pt-2 text-right font-semibold text-slate-900">
                    {groupHasUnknownCosts[groupIndex]
                      ? `Partial: ${formatCurrencyJMD(total)}`
                      : formatCurrencyJMD(total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <div className="space-y-4 border-t border-slate-200 px-6 py-4">
              <div>
                <label
                  htmlFor={`memo-${group.supplierExternalId}`}
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  PO Notes / Memo
                </label>
                <textarea
                  id={`memo-${group.supplierExternalId}`}
                  rows={3}
                  value={group.memo}
                  onChange={(event) =>
                    updateMemo(group.supplierExternalId, event.target.value)
                  }
                  disabled={isGenerated}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-tbc-red focus:outline-none focus:ring-2 focus:ring-tbc-red/20 disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="Optional notes to include on the purchase order"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {!isGenerated ? (
                  <>
                    <button
                      type="button"
                      disabled={
                        isPending ||
                        group.lines.length === 0 ||
                        generatingCoverNoteSupplierId ===
                          group.supplierExternalId
                      }
                      onClick={() => handleGenerateCoverNote(group, groupIndex)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-transparent shadow-card bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      {generatingCoverNoteSupplierId ===
                      group.supplierExternalId
                        ? "Generating..."
                        : "Generate AI cover note"}
                    </button>
                    <button
                      type="button"
                      disabled={
                        isPending &&
                        generatingSupplierId === group.supplierExternalId
                      }
                      onClick={() => handleGenerate(group)}
                      className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
                    >
                      {isPending &&
                      generatingSupplierId === group.supplierExternalId
                        ? "Generating..."
                        : "Generate PO"}
                    </button>
                  </>
                ) : (
                  <>
                    <a
                      href={`/api/purchase-orders/${group.generatedPo!.id}/pdf`}
                      className="inline-flex items-center gap-2 rounded-2xl border border-transparent shadow-card bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Download PDF
                    </a>
                    {canSend ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSendError(null);
                          setSendConfirmSupplierId(group.supplierExternalId);
                        }}
                        disabled={isPending}
                        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
                      >
                        <Send className="h-4 w-4" aria-hidden="true" />
                        Send Email
                      </button>
                    ) : group.generatedPo?.status === "sent" ? null : (
                      <span className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                        No email on file
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      <Modal
        open={Boolean(sendConfirmGroup)}
        onClose={() => {
          if (!isPending) {
            setSendConfirmSupplierId(null);
            setSendError(null);
          }
        }}
        ariaLabelledBy="review-send-title"
      >
        <h3 id="review-send-title" className="text-lg font-semibold text-slate-900">
          Send purchase order email?
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          This will email the purchase order with PDF attached to:
        </p>
        <p className="mt-3 text-sm font-medium text-slate-900">
          {sendConfirmGroup?.supplierEmail}
        </p>
        {sendError ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {sendError}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setSendConfirmSupplierId(null)}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              sendConfirmGroup && handleSendEmail(sendConfirmGroup)
            }
            disabled={isPending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {isPending && sendingSupplierId === sendConfirmSupplierId
              ? "Sending..."
              : "Confirm send"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
