type DataFreshnessBadgeProps = {
  lastSyncAt: string | null;
};

function formatFreshnessRelative(isoDate: string): string | null {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }

  const diffMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) {
    return "just now";
  }

  if (minutes === 1) {
    return "1 minute ago";
  }

  if (minutes < 60) {
    return `${minutes} minutes ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours === 1) {
    return "1 hour ago";
  }

  if (hours < 48) {
    return `${hours} hours ago`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) {
    return "1 day ago";
  }

  return `${days} days ago`;
}

function getFreshnessIconClass(lastSyncAt: string | null): string {
  if (!lastSyncAt) {
    return "text-[#CC2B2B]";
  }

  const timestamp = new Date(lastSyncAt).getTime();
  if (Number.isNaN(timestamp)) {
    return "text-[#CC2B2B]";
  }

  const hours = (Date.now() - timestamp) / (1000 * 60 * 60);

  if (hours < 25) {
    return "text-[#16A34A]";
  }

  if (hours <= 48) {
    return "text-[#B45309]";
  }

  return "text-[#CC2B2B]";
}

export function DataFreshnessBadge({ lastSyncAt }: DataFreshnessBadgeProps) {
  const relative =
    lastSyncAt === null ? null : formatFreshnessRelative(lastSyncAt);
  const label =
    relative === null ? "Sync status unknown" : `Inventory as of ${relative}`;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7280]">
      <i
        className={`ti ti-refresh text-xs ${getFreshnessIconClass(lastSyncAt)}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
