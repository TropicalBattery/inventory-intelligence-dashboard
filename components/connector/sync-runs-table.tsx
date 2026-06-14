import {
  getSyncStatusBadgeVariant,
  getSyncStatusLabel,
  getSyncStatusVariant,
} from "@/lib/connector/health";import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import {
  formatDateTime,
  formatNumber,
  formatSyncRunDuration,
  toNumber,
} from "@/lib/format";
import type { ConnectorSyncStatus } from "@/lib/types/database";

type SyncRunsTableProps = {
  syncRuns: ConnectorSyncStatus[];
};

function getRunDurationMs(
  startedAt: string | null,
  completedAt: string | null
): number | null {
  if (!startedAt || !completedAt) {
    return null;
  }

  return new Date(completedAt).getTime() - new Date(startedAt).getTime();
}

export function SyncRunsTable({ syncRuns }: SyncRunsTableProps) {
  return (
    <Card className="p-0">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Recent Sync Runs</h2>
        <p className="mt-1 text-sm text-slate-500">
          Latest 50 connector sync jobs, most recent first.
        </p>
      </div>

      {syncRuns.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-slate-500">
          No sync data yet.
        </div>
      ) : (
        <Table containerClassName="rounded-none border-0">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Job name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Read</TableHead>
              <TableHead className="text-right">Pushed</TableHead>
              <TableHead className="text-right">Failed</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Errors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {syncRuns.map((run) => {
              const variant = getSyncStatusVariant(run.status);
              const recordsFailed = toNumber(run.records_failed);
              const durationMs = getRunDurationMs(run.started_at, run.completed_at);

              return (
                <TableRow key={run.id}>
                  <TableCell className="font-medium text-slate-900">
                    {run.job_name ?? "Unknown job"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getSyncStatusBadgeVariant(variant)}>
                      {getSyncStatusLabel(run.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(toNumber(run.records_read))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(toNumber(run.records_pushed))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(recordsFailed)}
                  </TableCell>
                  <TableCell>{formatDateTime(run.started_at)}</TableCell>
                  <TableCell>
                    {durationMs === null
                      ? "N/A"
                      : formatSyncRunDuration(durationMs)}
                  </TableCell>
                  <TableCell>
                    {recordsFailed > 0 ? (
                      <span className="text-sm font-medium text-tbc-red">
                        {formatNumber(recordsFailed)} failed
                      </span>
                    ) : (
                      <span className="text-[#9CA3AF]">-</span>
                    )}
                  </TableCell>                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
