"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { canTransition } from "@/lib/po/approval";

type PoListQuickTransitionProps = {
  poId: string;
  status: string;
};

export function PoListQuickTransition({
  poId,
  status,
}: PoListQuickTransitionProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quick =
    status === "draft" && canTransition("draft", "pending_approval")
      ? { toStatus: "pending_approval" as const, label: "Submit for approval" }
      : status === "pending_approval" &&
          canTransition("pending_approval", "approved")
        ? { toStatus: "approved" as const, label: "Approve" }
        : null;

  if (!quick) {
    return null;
  }

  async function handleClick() {
    if (!quick) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/purchase-orders/${encodeURIComponent(poId)}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toStatus: quick.toStatus }),
        }
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Transition failed");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => {
          void handleClick();
        }}
        className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "…" : quick.label}
      </button>
      {error ? (
        <span className="max-w-[8rem] text-[10px] text-[#CC2B2B]">{error}</span>
      ) : null}
    </div>
  );
}
