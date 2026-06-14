const numberFormatter = new Intl.NumberFormat("en-JM");
const currencyFormatter = new Intl.NumberFormat("en-JM", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatSuggestedQty(value: number | null | undefined): string {
  if (value === null || value === undefined || value <= 0 || Number.isNaN(value)) {
    return "-";
  }

  return formatNumber(value);
}

export function formatCurrencyJMD(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return `J$${currencyFormatter.format(value)}`;
}

export function formatDurationMs(durationMs: number): string {
  if (durationMs < 0 || Number.isNaN(durationMs)) {
    return "N/A";
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function formatSyncRunDuration(durationMs: number): string {
  if (durationMs < 0 || Number.isNaN(durationMs)) {
    return "N/A";
  }

  if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${seconds}s`;
}

export function formatMinutesAgo(minutes: number): string {
  if (minutes < 1) {
    return "just now";
  }

  if (minutes === 1) {
    return "1 minute ago";
  }

  return `${Math.floor(minutes)} minutes ago`;
}

export function formatRelativeTimeShort(isoDate: string | null): string {
  if (!isoDate) {
    return "Never";
  }

  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) {
    return "Unknown";
  }

  const diffMs = Date.now() - timestamp;
  if (diffMs < 60000) {
    return "Just now";
  }

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getSyncAgeTone(
  isoDate: string | null
): "success" | "warning" | "danger" {
  if (!isoDate) {
    return "danger";
  }

  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) {
    return "danger";
  }

  const hours = (Date.now() - timestamp) / (1000 * 60 * 60);
  if (hours < 25) {
    return "success";
  }

  if (hours <= 48) {
    return "warning";
  }

  return "danger";
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-JM", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatUptimeSeconds(uptimeSeconds: number | null): string {
  if (uptimeSeconds === null || uptimeSeconds === undefined) {
    return "N/A";
  }

  const totalSeconds = Math.floor(uptimeSeconds);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes}m`);
  }

  return parts.join(" ");
}

export function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
