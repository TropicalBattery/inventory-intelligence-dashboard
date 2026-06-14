export function resolvePoSupplierDisplayName(
  supplierName: string | null | undefined,
  supplierExternalId: string | null | undefined,
  context?: string
): string {
  if (supplierName?.trim()) {
    return supplierName.trim();
  }

  if (supplierExternalId?.trim()) {
    const contextSuffix = context ? ` (${context})` : "";
    console.warn(
      `[PO] Supplier lookup failed for external ID "${supplierExternalId.trim()}"${contextSuffix}; falling back to external ID for display.`
    );
    return supplierExternalId.trim();
  }

  return "Supplier not specified";
}
