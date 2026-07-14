import type { PoAuditLogRow } from "@/lib/po/approval";

type PoAuditTrailProps = {
  entries: PoAuditLogRow[];
};

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  submitted_for_approval: "Submitted for approval",
  approved: "Approved",
  sent: "Sent",
  suppressed: "Suppressed",
  reverted_to_draft: "Reverted to draft",
  quantity_overridden: "Quantity overridden",
};

function actionDotClass(action: string): string {
  switch (action) {
    case "created":
      return "bg-[#9CA3AF]";
    case "approved":
      return "bg-[#1D4ED8]";
    case "sent":
      return "bg-[#16A34A]";
    case "suppressed":
      return "bg-[#CC2B2B]";
    default:
      return "bg-[#B45309]";
  }
}

function formatActionLabel(action: string): string {
  return (
    ACTION_LABELS[action] ??
    action
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return iso;
  }

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }

  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PoAuditTrail({ entries }: PoAuditTrailProps) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-card">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
        Activity
      </h3>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-[#9CA3AF]">No activity recorded yet.</p>
      ) : (
        <ol className="relative mt-5 space-y-5 border-l border-[#E5E7EB] pl-5">
          {entries.map((entry) => (
            <li key={entry.id} className="relative">
              <span
                className={`absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${actionDotClass(entry.action)}`}
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-[#111111]">
                {formatActionLabel(entry.action)} by {entry.actor}
              </p>
              <p className="mt-0.5 text-xs text-[#9CA3AF]">
                {formatRelativeTime(entry.createdAt)}
              </p>
              {entry.note ? (
                <p className="mt-1 text-xs italic text-[#6B7280]">
                  {entry.note}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
