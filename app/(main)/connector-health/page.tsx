import { ConnectorStatusCard } from "@/components/connector/connector-status-card";
import { SyncRunsTable } from "@/components/connector/sync-runs-table";
import {  getConnectorHealthState,
  getLastSuccessfulSyncCompletedAt,
} from "@/lib/connector/health";
import {
  getLatestConnectorHeartbeat,
  getRecentSyncRuns,
} from "@/lib/queries/connector-health";

export default async function ConnectorHealthPage() {
  const [heartbeat, syncRuns] = await Promise.all([
    getLatestConnectorHeartbeat(),
    getRecentSyncRuns(),
  ]);

  const health = getConnectorHealthState(heartbeat?.sent_at ?? null);
  const lastSuccessfulSyncAt = getLastSuccessfulSyncCompletedAt(syncRuns);

  return (
    <div className="space-y-8">
      <ConnectorStatusCard        heartbeat={heartbeat}
        healthLevel={health.level}
        minutesAgo={health.minutesAgo}
        lastSuccessfulSyncAt={lastSuccessfulSyncAt}
      />

      <p className="rounded-2xl bg-white px-6 py-4 text-sm text-[#9CA3AF] shadow-card">
        Error log coming soon — detailed sync error messages will appear here
        once connector error logging is enabled.
      </p>

      <SyncRunsTable syncRuns={syncRuns} />    </div>
  );
}
