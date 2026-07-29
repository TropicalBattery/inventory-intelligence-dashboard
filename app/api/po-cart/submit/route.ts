import {
  coerceOptionalString,
  requireUserEmail,
} from "@/lib/po/cart-auth";
import { getUserRole } from "@/lib/auth/roles";
import { fetchUserCartItems, mapCartRow, type PoCartItemRow } from "@/lib/po/cart";
import type { PoStatus } from "@/lib/po/approval";
import {
  clearSupplierCartGroup,
  createPurchaseOrderFromSupplierCartGroup,
  PoWorkflowError,
  transitionPurchaseOrder,
} from "@/lib/po/workflow";
import type { PoCreationResult } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type SaveMode = "draft" | "submit_for_approval";
type GroupReadiness = "ready_for_approval" | "needs_pricing" | "supplier_required";

type SupplierGroup = {
  supplierExternalId: string | null;
  rows: PoCartItemRow[];
  hasInvalidQuantity: boolean;
  hasMissingPrice: boolean;
  readiness: GroupReadiness;
  eligibleForDraft: boolean;
  eligibleForApproval: boolean;
};

function classifyGroup(group: SupplierGroup): GroupReadiness {
  if (!group.supplierExternalId) {
    return "supplier_required";
  }
  if (group.hasMissingPrice) {
    return "needs_pricing";
  }
  return "ready_for_approval";
}

function groupCartRows(rows: PoCartItemRow[]): SupplierGroup[] {
  const map = new Map<string, PoCartItemRow[]>();
  for (const row of rows) {
    const key = row.supplier_external_id ?? "__UNASSIGNED__";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  const groups: SupplierGroup[] = [];
  for (const [key, groupRows] of Array.from(map.entries())) {
    const supplierExternalId = key === "__UNASSIGNED__" ? null : key;
    const items = groupRows.map((row: PoCartItemRow) => mapCartRow(row));
    const hasInvalidQuantity = items.some((item: { quantity: number }) => !(item.quantity > 0));
    const hasMissingPrice = items.some(
      (item: { unitPrice: number | null }) =>
        item.unitPrice === null || !Number.isFinite(item.unitPrice)
    );
    const group: SupplierGroup = {
      supplierExternalId,
      rows: groupRows,
      hasInvalidQuantity,
      hasMissingPrice,
      readiness: "supplier_required",
      eligibleForDraft: false,
      eligibleForApproval: false,
    };
    group.readiness = classifyGroup(group);
    group.eligibleForDraft =
      Boolean(group.supplierExternalId) && !group.hasInvalidQuantity;
    group.eligibleForApproval =
      Boolean(group.supplierExternalId) &&
      !group.hasInvalidQuantity &&
      !group.hasMissingPrice;
    groups.push(group);
  }

  return groups.sort((left, right) => {
    const a = left.supplierExternalId ?? "UNASSIGNED";
    const b = right.supplierExternalId ?? "UNASSIGNED";
    return a.localeCompare(b);
  });
}

export async function POST(request: Request) {
  try {
    const auth = await requireUserEmail();
    if ("error" in auth) {
      return auth.error;
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const legacySupplierExternalId = coerceOptionalString(body.supplierExternalId);
    const requestedMode =
      typeof body.saveMode === "string" ? body.saveMode.trim() : "";
    const saveMode: SaveMode =
      requestedMode === "submit_for_approval"
        ? "submit_for_approval"
        : "draft";

    const requestedSupplierIds = Array.isArray(body.supplierExternalIds)
      ? body.supplierExternalIds
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter((value): value is string => Boolean(value))
      : legacySupplierExternalId
        ? [legacySupplierExternalId]
        : [];

    const cartRows = await fetchUserCartItems(auth.email);
    const grouped = groupCartRows(cartRows);
    const scopedGroups = grouped.filter((group) =>
      requestedSupplierIds.length === 0
        ? true
        : group.supplierExternalId
          ? requestedSupplierIds.includes(group.supplierExternalId)
          : false
    );

    if (scopedGroups.length === 0) {
      return NextResponse.json(
        { error: "No cart items matched the selected supplier groups." },
        { status: 400 }
      );
    }

    const actorRole = await getUserRole(auth.email);
    const results: PoCreationResult[] = [];
    const skipped: Array<{ supplierExternalId: string; reason: string }> = [];
    let createdCount = 0;
    let sentForApprovalCount = 0;

    for (const group of scopedGroups) {
      const supplierExternalId = group.supplierExternalId ?? "UNASSIGNED";
      const eligible =
        saveMode === "submit_for_approval"
          ? group.eligibleForApproval
          : group.eligibleForDraft;

      if (!eligible || !group.supplierExternalId) {
        let reason = "Group is not eligible for this action.";
        if (!group.supplierExternalId) {
          reason = "Supplier required.";
        } else if (group.hasInvalidQuantity) {
          reason = "Invalid quantity on one or more lines.";
        } else if (saveMode === "submit_for_approval" && group.hasMissingPrice) {
          reason = "Pricing is incomplete.";
        }
        skipped.push({ supplierExternalId, reason });
        results.push({
          supplierExternalId,
          success: false,
          error: reason,
        });
        continue;
      }

      try {
        const created = await createPurchaseOrderFromSupplierCartGroup({
          supplierExternalId: group.supplierExternalId,
          createdByEmail: auth.email,
          clearCartOnSuccess: false,
        });

        let finalStatus: PoStatus = "draft";
        if (saveMode === "submit_for_approval") {
          const transitioned = await transitionPurchaseOrder({
            purchaseOrderId: created.purchaseOrderId,
            toStatus: "pending_approval",
            actorUserId: auth.email,
            actorEmail: auth.email,
            actorRole,
          });
          finalStatus = transitioned.status;
          sentForApprovalCount += 1;
        }

        await clearSupplierCartGroup(auth.email, group.supplierExternalId);
        createdCount += 1;
        results.push({
          supplierExternalId: group.supplierExternalId,
          success: true,
          purchaseOrderId: created.purchaseOrderId,
          poNumber: created.poNumber,
          status: finalStatus === "pending_approval" ? "pending_approval" : "draft",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create PO.";
        results.push({
          supplierExternalId: group.supplierExternalId,
          success: false,
          error: message,
        });
      }
    }

    revalidatePath("/purchase-orders");
    revalidatePath("/purchase-orders/review");
    revalidatePath("/reorder");
    revalidatePath("/dashboard");

    const remainingGroups = scopedGroups.length - createdCount;
    const processedGroups = results.filter((result) => result.success).length;

    return NextResponse.json({
      saveMode,
      results,
      summary: {
        totalGroups: scopedGroups.length,
        processedGroups,
        skippedGroups: skipped.length,
        remainingGroups,
        createdCount,
        sentForApprovalCount,
      },
      skipped,
    });
  } catch (error) {
    if (error instanceof PoWorkflowError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/po-cart/submit failed:", error);
    return NextResponse.json(
      { error: "Failed to process cart groups" },
      { status: 500 }
    );
  }
}
