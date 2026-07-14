"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ALLOWED_TRANSITIONS,
  isPoStatus,
  type PoStatus,
} from "@/lib/po/approval";

type PoTransitionButtonsProps = {
  poId: string;
  status: string;
  /** toolbar = single-row primary + icon suppress/ghosts (detail header) */
  layout?: "stack" | "toolbar";
};

type TransitionIntent = {
  toStatus: PoStatus;
  label: string;
  variant: "primary" | "ghost";
  needsNote: boolean;
};

function buildIntents(from: PoStatus): TransitionIntent[] {
  return ALLOWED_TRANSITIONS[from].map((toStatus) => {
    if (toStatus === "pending_approval") {
      return {
        toStatus,
        label: "Submit for approval",
        variant: "primary",
        needsNote: false,
      };
    }
    if (toStatus === "approved") {
      return {
        toStatus,
        label: "Approve",
        variant: "primary",
        needsNote: false,
      };
    }
    if (toStatus === "sent") {
      return {
        toStatus,
        label: "Mark as sent",
        variant: "primary",
        needsNote: false,
      };
    }
    if (toStatus === "suppressed") {
      return {
        toStatus,
        label: "Suppress",
        variant: "ghost",
        needsNote: true,
      };
    }
    return {
      toStatus,
      label: from === "suppressed" ? "Revive as draft" : "Return to draft",
      variant: "ghost",
      needsNote: true,
    };
  });
}

const primaryClassName =
  "h-9 rounded-lg bg-[#CC2B2B] px-3 text-sm font-medium text-white transition-colors hover:bg-[#B02626] disabled:cursor-not-allowed disabled:opacity-60";

const ghostClassName =
  "h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60";

const iconButtonClassName =
  "flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B7280] transition-colors hover:border-[#CC2B2B] hover:text-[#CC2B2B] disabled:cursor-not-allowed disabled:opacity-60";

export function PoTransitionButtons({
  poId,
  status,
  layout = "stack",
}: PoTransitionButtonsProps) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [pendingTo, setPendingTo] = useState<PoStatus | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  const intents = useMemo(() => {
    if (!isPoStatus(currentStatus)) {
      return [];
    }
    return buildIntents(currentStatus);
  }, [currentStatus]);

  async function runTransition(
    toStatus: PoStatus,
    transitionNote: string | null
  ) {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/purchase-orders/${encodeURIComponent(poId)}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toStatus,
            ...(transitionNote ? { note: transitionNote } : {}),
          }),
        }
      );
      const data = (await response.json().catch(() => null)) as {
        status?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.status) {
        throw new Error(data?.error ?? "Transition failed");
      }

      setCurrentStatus(data.status);
      setPendingTo(null);
      setNote("");
      setSuccess(`Status updated to ${data.status.replace(/_/g, " ")}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transition failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleIntentClick(intent: TransitionIntent) {
    setError(null);
    setSuccess(null);

    if (intent.needsNote) {
      setPendingTo(intent.toStatus);
      setNote("");
      return;
    }

    void runTransition(intent.toStatus, null);
  }

  if (!isPoStatus(currentStatus)) {
    return (
      <p className="text-xs text-[#9CA3AF]">Unknown status: {currentStatus}</p>
    );
  }

  if (currentStatus === "sent") {
    return <p className="text-sm text-[#9CA3AF]">Completed</p>;
  }

  const pendingIntent = pendingTo
    ? intents.find((intent) => intent.toStatus === pendingTo) ?? null
    : null;

  const toolbar = layout === "toolbar";

  return (
    <div
      className={
        toolbar
          ? "flex flex-wrap items-center gap-2"
          : "flex flex-col items-stretch gap-2 sm:items-end"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {intents.map((intent) => {
          if (toolbar && intent.toStatus === "suppressed") {
            return (
              <button
                key={intent.toStatus}
                type="button"
                disabled={isSubmitting}
                title="Suppress"
                aria-label="Suppress"
                onClick={() => handleIntentClick(intent)}
                className={iconButtonClassName}
              >
                <i className="ti ti-ban text-base" aria-hidden="true" />
              </button>
            );
          }

          return (
            <button
              key={intent.toStatus}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleIntentClick(intent)}
              className={
                intent.variant === "primary" ? primaryClassName : ghostClassName
              }
            >
              {isSubmitting &&
              pendingTo === null &&
              intent.variant === "primary"
                ? "Working…"
                : intent.label}
            </button>
          );
        })}
      </div>

      {pendingIntent ? (
        <div className="w-full min-w-[16rem] max-w-sm rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3">
          <p className="text-xs font-medium text-[#374151]">
            {pendingIntent.label} — optional reason
          </p>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Reason (optional)"
            className="mt-2 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111111] focus:border-[#CC2B2B] focus:outline-none focus:ring-2 focus:ring-[#CC2B2B]/10"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setPendingTo(null);
                setNote("");
              }}
              className={ghostClassName}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                void runTransition(
                  pendingIntent.toStatus,
                  note.trim() || null
                );
              }}
              className={primaryClassName}
            >
              {isSubmitting ? "Confirming…" : "Confirm"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-[#CC2B2B]">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="text-xs text-[#16A34A]">
          {success}
        </p>
      ) : null}
    </div>
  );
}
