export type ConnectorHealthLevel = "healthy" | "degraded" | "offline";

export type ConnectorHealthState = {
  level: ConnectorHealthLevel;
  label: string;
  minutesAgo: number | null;
};

const HEALTHY_THRESHOLD_MINUTES = 15;
const DEGRADED_THRESHOLD_MINUTES = 60;

export function getConnectorHealthState(
  sentAt: string | null
): ConnectorHealthState {
  if (!sentAt) {
    return {
      level: "offline",
      label: "Offline",
      minutesAgo: null,
    };
  }

  const sentDate = new Date(sentAt);
  const minutesAgo = (Date.now() - sentDate.getTime()) / (1000 * 60);

  if (minutesAgo <= HEALTHY_THRESHOLD_MINUTES) {
    return {
      level: "healthy",
      label: "Healthy",
      minutesAgo,
    };
  }

  if (minutesAgo <= DEGRADED_THRESHOLD_MINUTES) {
    return {
      level: "degraded",
      label: "Degraded",
      minutesAgo,
    };
  }

  return {
    level: "offline",
    label: "Offline",
    minutesAgo,
  };
}

export function getHealthCardTitle(level: ConnectorHealthLevel): string {
  switch (level) {
    case "healthy":
      return "Healthy";
    case "degraded":
      return "Degraded";
    case "offline":
      return "Offline";
  }
}

export function getHealthCardStyles(level: ConnectorHealthLevel): {
  border: string;
  background: string;
  indicator: string;
  text: string;
} {
  switch (level) {
    case "healthy":
      return {
        border: "border-emerald-200",
        background: "bg-emerald-50",
        indicator: "bg-emerald-500",
        text: "text-emerald-800",
      };
    case "degraded":
      return {
        border: "border-amber-200",
        background: "bg-amber-50",
        indicator: "bg-amber-500",
        text: "text-amber-800",
      };
    case "offline":
      return {
        border: "border-red-200",
        background: "bg-red-50",
        indicator: "bg-red-500",
        text: "text-red-800",
      };
  }
}

export type SyncStatusVariant = "success" | "failed" | "partial" | "unknown";

export function getSyncStatusVariant(
  status: string | null
): SyncStatusVariant {
  const normalized = status?.trim().toLowerCase() ?? "";

  if (normalized === "success" || normalized === "succeeded") {
    return "success";
  }

  if (normalized === "failed" || normalized === "failure" || normalized === "error") {
    return "failed";
  }

  if (normalized === "partial") {
    return "partial";
  }

  return "unknown";
}

export function getSyncStatusLabel(status: string | null): string {
  if (!status) {
    return "Unknown";
  }

  const variant = getSyncStatusVariant(status);

  switch (variant) {
    case "success":
      return "Success";
    case "failed":
      return "Failed";
    case "partial":
      return "Partial";
    default:
      return status;
  }
}

export function getSyncStatusBadgeVariant(
  variant: SyncStatusVariant
): "success" | "warning" | "danger" | "neutral" {
  switch (variant) {
    case "success":
      return "success";
    case "failed":
      return "danger";
    case "partial":
      return "warning";
    default:
      return "neutral";
  }
}

export function getLastSuccessfulSyncCompletedAt(
  syncRuns: Array<{ status: string | null; completed_at: string | null }>
): string | null {
  for (const run of syncRuns) {
    if (getSyncStatusVariant(run.status) === "success" && run.completed_at) {
      return run.completed_at;
    }
  }

  return null;
}
