import { getUserRole } from "@/lib/auth/roles";
import {
  lookupSupplierUnitPrice,
  supplierExistsForSku,
} from "@/lib/po/supplier-price";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_ID } from "@/lib/tenant";

export type VendorLockSupplierResult =
  | {
      ok: true;
      supplierExternalId: string;
      unitPrice: number | null;
      stampUpdates: {
        lock_override_reason: string | null;
        lock_overridden_by: string | null;
        lock_overridden_at: string | null;
        lock_original_vendor: string | null;
      };
    }
  | { ok: false; status: number; error: string };

function parseOverrideReason(override: unknown): string {
  if (!override || typeof override !== "object") {
    return "";
  }
  const reason = (override as { reason?: unknown }).reason;
  return typeof reason === "string" ? reason.trim() : "";
}

/**
 * Resolves supplier + lock stamps for a vendor_lock SKU when the client
 * requested a supplier change. Call only when rule is vendor_lock with a
 * lockedVendorId. Writes po_lock_overrides when an override is accepted.
 */
export async function resolveVendorLockSupplierChange(params: {
  sku: string;
  lockedVendorId: string;
  requestedSupplierExternalId: string | null;
  hasOverride: boolean;
  overridePayload: unknown;
  actorEmail: string;
}): Promise<VendorLockSupplierResult> {
  const {
    sku,
    lockedVendorId,
    requestedSupplierExternalId,
    hasOverride,
    overridePayload,
    actorEmail,
  } = params;

  let supplierExternalId = requestedSupplierExternalId;

  if (supplierExternalId === null) {
    supplierExternalId = lockedVendorId;
  }

  const differsFromLock = supplierExternalId !== lockedVendorId;

  if (differsFromLock) {
    if (!hasOverride) {
      supplierExternalId = lockedVendorId;
    } else {
      const role = await getUserRole(actorEmail);
      if (role !== "approver") {
        return {
          ok: false,
          status: 403,
          error: "Override requires approver role",
        };
      }

      const reason = parseOverrideReason(overridePayload);
      if (!reason) {
        return {
          ok: false,
          status: 400,
          error: "Override reason is required",
        };
      }

      const supplierOk = await supplierExistsForSku(sku, supplierExternalId);
      if (!supplierOk) {
        return {
          ok: false,
          status: 400,
          error: "Selected supplier is not available for this item",
        };
      }

      const supabase = createAdminClient();
      const { error: auditError } = await supabase
        .from("po_lock_overrides")
        .insert({
          tenant_id: TENANT_ID,
          sku,
          original_vendor: lockedVendorId,
          override_vendor: supplierExternalId,
          reason,
          overridden_by: actorEmail,
        });

      if (auditError) {
        return { ok: false, status: 500, error: auditError.message };
      }

      const unitPrice = await lookupSupplierUnitPrice(sku, supplierExternalId);
      return {
        ok: true,
        supplierExternalId,
        unitPrice,
        stampUpdates: {
          lock_override_reason: reason,
          lock_overridden_by: actorEmail,
          lock_overridden_at: new Date().toISOString(),
          lock_original_vendor: lockedVendorId,
        },
      };
    }
  }

  const unitPrice = await lookupSupplierUnitPrice(sku, supplierExternalId);
  return {
    ok: true,
    supplierExternalId,
    unitPrice,
    stampUpdates: {
      lock_override_reason: null,
      lock_overridden_by: null,
      lock_overridden_at: null,
      lock_original_vendor: null,
    },
  };
}
