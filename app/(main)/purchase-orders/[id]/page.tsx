import Link from "next/link";
import { notFound } from "next/navigation";
import { PoAuditTrail } from "@/components/po/po-audit-trail";
import { PoDetailActions } from "@/components/purchase-orders/po-detail-actions";
import { getUserRole } from "@/lib/auth/roles";
import { fetchPoAuditLog } from "@/lib/po/approval";
import { getPurchaseOrderDocumentWithReferenceDetails } from "@/lib/queries/purchase-orders";
import { createClient } from "@/lib/supabase/server";

type PurchaseOrderDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function PurchaseOrderDetailPage({
  params,
}: PurchaseOrderDetailPageProps) {
  const purchaseOrder = await getPurchaseOrderDocumentWithReferenceDetails(
    params.id
  );

  if (!purchaseOrder) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userEmail = user?.email?.trim() ?? "";
  const userRole = userEmail ? await getUserRole(userEmail) : "buyer";

  let auditEntries: Awaited<ReturnType<typeof fetchPoAuditLog>> = [];
  try {
    auditEntries = await fetchPoAuditLog(params.id);
  } catch (error) {
    console.error("Failed to load PO audit trail:", error);
  }

  return (
    <div className="space-y-4">
      <Link
        href="/purchase-orders"
        className="inline-flex text-sm font-medium text-[#CC2B2B] hover:underline"
      >
        Back to Purchase Orders
      </Link>
      <PoDetailActions
        purchaseOrder={purchaseOrder}
        userRole={userRole}
        userEmail={userEmail}
      />
      <PoAuditTrail entries={auditEntries} />
    </div>
  );
}
