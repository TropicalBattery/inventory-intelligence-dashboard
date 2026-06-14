import { WifiOff } from "lucide-react";
import { CopyMachineNameButton } from "@/components/connector/copy-machine-name-button";
import {
  getHealthCardTitle,
  type ConnectorHealthLevel,
} from "@/lib/connector/health";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  formatDateTime,
  formatMinutesAgo,
  formatUptimeSeconds,
  getSyncAgeTone,
} from "@/lib/format";
import type { ConnectorHeartbeat } from "@/lib/types/database";

type ConnectorStatusCardProps = {
  heartbeat: ConnectorHeartbeat | null;
  healthLevel: ConnectorHealthLevel;
  minutesAgo: number | null;
  lastSuccessfulSyncAt: string | null;
};

function isHealthyLevel(level: ConnectorHealthLevel): boolean {
  return level === "healthy";
}

function getLastSeenLabel(minutesAgo: number | null): string {
  if (minutesAgo === null) {
    return "never";
  }

  return formatMinutesAgo(minutesAgo);
}

function getSyncDisplay(lastSuccessfulSyncAt: string | null): {
  label: string;
  tone: "success" | "warning" | "danger";
} {
  const tone = getSyncAgeTone(lastSuccessfulSyncAt);
  const label = lastSuccessfulSyncAt
    ? formatDateTime(lastSuccessfulSyncAt)
    : "Never";

  return { label, tone };
}

const syncToneClasses = {
  success: {
    dot: "bg-green-500",
    text: "text-[#111111] dark:text-[#F4F4F5]",
  },
  warning: {
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  danger: {
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
} as const;

export function ConnectorStatusCard({
  heartbeat,
  healthLevel,
  minutesAgo,
  lastSuccessfulSyncAt,
}: ConnectorStatusCardProps) {
  if (!heartbeat) {
    return (
      <Card>
        <EmptyState
          icon={WifiOff}
          title="No connector data yet"
          description="The connector hasn't reported in. Check that it's running and configured correctly."
        />
      </Card>
    );
  }

  const healthy = isHealthyLevel(healthLevel);
  const machineName = heartbeat.connector_id ?? "Unknown connector";
  const uptimeLabel = formatUptimeSeconds(heartbeat.uptime_seconds);
  const syncDisplay = getSyncDisplay(lastSuccessfulSyncAt);
  const syncStyles = syncToneClasses[syncDisplay.tone];

  return (
    <div className="rounded-2xl bg-white p-6 shadow-card dark:bg-[#1A1A1A]">
      <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
        <div>
          <div className="flex items-center gap-3">
            <span
              className={`h-3 w-3 animate-pulse rounded-full ${
                healthy ? "bg-green-500" : "bg-red-500"
              }`}
              aria-hidden="true"
            />
            <p
              className={`text-2xl font-bold ${
                healthy
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {getHealthCardTitle(healthLevel)}
            </p>
          </div>

          <p className="mt-1 text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Last seen: {getLastSeenLabel(minutesAgo)}
          </p>

          <span className="mt-4 inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400">
            <i className="ti ti-clock text-xs" aria-hidden="true" />
            Uptime {uptimeLabel}
          </span>
        </div>

        <dl className="space-y-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#9CA3AF]">
              Machine Name
            </dt>
            <dd className="mt-0.5 flex items-center gap-2">
              <span className="truncate font-mono text-xs font-medium text-[#111111] dark:text-[#F4F4F5]">
                {machineName}
              </span>
              <CopyMachineNameButton value={machineName} />
            </dd>
          </div>

          <div>
            <dt className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#9CA3AF]">
              Version
            </dt>
            <dd className="mt-0.5">
              <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400">
                {heartbeat.version ?? "N/A"}
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#9CA3AF]">
              Last Successful Sync
            </dt>
            <dd className="mt-0.5">
              <span
                className={`inline-flex items-center gap-2 text-sm font-medium ${syncStyles.text}`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${syncStyles.dot}`}
                  aria-hidden="true"
                />
                {syncDisplay.label}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
