import { isPoStatus, type PoStatus } from "@/lib/po/approval";

const BADGE_CLASSES: Record<PoStatus, string> = {
  draft: "bg-[#F3F4F6] text-[#6B7280]",
  pending_approval: "bg-[#FFFBEB] text-[#B45309]",
  approved: "bg-[#EFF6FF] text-[#1D4ED8]",
  sent: "bg-[#F0FDF4] text-[#16A34A]",
  suppressed: "bg-[#FDF2F2] text-[#CC2B2B]",
};

const BADGE_LABELS: Record<PoStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  sent: "Sent",
  suppressed: "Suppressed",
};

type PoStatusBadgeProps = {
  status: string;
  className?: string;
};

export function PoStatusBadge({ status, className = "" }: PoStatusBadgeProps) {
  const normalized = status.trim().toLowerCase();
  const known = isPoStatus(normalized) ? normalized : null;
  const classes = known
    ? BADGE_CLASSES[known]
    : "bg-[#F3F4F6] text-[#6B7280]";
  const label = known
    ? BADGE_LABELS[known]
    : status
      ? status.charAt(0).toUpperCase() + status.slice(1)
      : "Unknown";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${classes} ${className}`.trim()}
    >
      {label}
    </span>
  );
}
