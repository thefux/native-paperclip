import { useQuery } from "@tanstack/react-query";
import { useActiveClient } from "@/lib/store/use-active-client";
import { dashboardApi, type DashboardSummary } from "@/lib/api/dashboard";
import { Badge, Card } from "@/components/ui";
import { cn, formatRelativeTime } from "@/lib/utils";

const STATUS_TONES: Record<
  string,
  "neutral" | "info" | "warn" | "danger" | "success"
> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "info",
  in_review: "warn",
  blocked: "danger",
  done: "success",
  cancelled: "neutral",
};

/**
 * Read-only dashboard for the active company. Drives off
 * `GET /api/companies/:cid/dashboard` and renders whatever subset of
 * fields the server returns. Designed to be permissive: missing keys
 * just hide the corresponding card.
 */
export function DashboardView({ onOpenIssue }: { onOpenIssue: (id: string) => void }) {
  const { instance, client, prefix, companyId } = useActiveClient();

  const dash = useQuery<DashboardSummary | null>({
    queryKey: [prefix, "dashboard", companyId] as const,
    queryFn: () =>
      client && companyId ? dashboardApi.get(client, companyId) : Promise.resolve(null),
    enabled: !!client && !!companyId,
    retry: false,
  });

  if (!client) return null;
  if (!companyId)
    return <div className="p-3 text-sm text-muted">No company selected.</div>;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2 text-xs uppercase tracking-wide text-muted">
        Dashboard{instance?.identity?.companyName ? ` — ${instance.identity.companyName}` : ""}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {dash.isLoading && <p className="text-sm text-muted">Loading dashboard…</p>}

        {dash.isError && (
          <Card className="border-yellow-500/40 bg-yellow-500/5">
            <p className="text-sm text-muted">
              Dashboard unavailable on this instance:{" "}
              <code className="text-xs">{(dash.error as Error).message}</code>
            </p>
          </Card>
        )}

        {dash.data && (
          <div className="grid gap-4 lg:grid-cols-2">
            <CountsCard
              title="Issues by status"
              counts={dash.data.issueCountsByStatus}
              tones={STATUS_TONES}
            />
            <CountsCard
              title="Issues by priority"
              counts={dash.data.issueCountsByPriority}
              tones={{
                critical: "danger",
                high: "warn",
                medium: "info",
                low: "neutral",
              }}
            />

            {typeof dash.data.pendingApprovals === "number" && (
              <Card className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted">
                  Pending approvals
                </div>
                <div className="text-2xl font-semibold">{dash.data.pendingApprovals}</div>
              </Card>
            )}

            {dash.data.recentIssues && dash.data.recentIssues.length > 0 && (
              <Card className="lg:col-span-2 space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted">
                  Recent issues
                </div>
                <ul className="divide-y divide-border/40 text-sm">
                  {dash.data.recentIssues.slice(0, 12).map((issue) => (
                    <li key={issue.id}>
                      <button
                        onClick={() => onOpenIssue(issue.id)}
                        className="flex w-full items-center gap-2 py-1.5 text-left hover:bg-border/30"
                      >
                        <span className="font-mono text-xs text-muted">
                          {issue.identifier}
                        </span>
                        <Badge tone={STATUS_TONES[issue.status] ?? "neutral"}>
                          {issue.status}
                        </Badge>
                        <span className="truncate">{issue.title}</span>
                        <span className="ml-auto text-xs text-muted">
                          {formatRelativeTime(issue.updatedAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {dash.data.activeAgents && dash.data.activeAgents.length > 0 && (
              <Card className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted">
                  Active agents
                </div>
                <ul className="space-y-1 text-sm">
                  {dash.data.activeAgents.map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <span className="truncate">{a.name}</span>
                      {a.role && (
                        <span className="text-xs text-muted">· {a.role}</span>
                      )}
                      {typeof a.activeRunCount === "number" && a.activeRunCount > 0 && (
                        <Badge tone="info">{a.activeRunCount} running</Badge>
                      )}
                      {a.lastSeenAt && (
                        <span className="ml-auto text-xs text-muted">
                          {formatRelativeTime(a.lastSeenAt)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {dash.data.recentRuns && dash.data.recentRuns.length > 0 && (
              <Card className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted">
                  Recent runs
                </div>
                <ul className="space-y-1 text-sm">
                  {dash.data.recentRuns.slice(0, 8).map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted">
                        {r.id.slice(0, 8)}…
                      </span>
                      <Badge tone={runTone(r.status)}>{r.status}</Badge>
                      <span className="ml-auto text-xs text-muted">
                        {formatRelativeTime(r.endedAt ?? r.startedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CountsCard({
  title,
  counts,
  tones,
}: {
  title: string;
  counts: Record<string, number> | undefined;
  tones: Record<string, "neutral" | "info" | "warn" | "danger" | "success">;
}) {
  if (!counts || Object.keys(counts).length === 0) return null;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((acc, [, n]) => acc + n, 0);
  return (
    <Card className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-muted">{title}</div>
      <div className="text-2xl font-semibold">{total}</div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        {entries.map(([k, n]) => (
          <span
            key={k}
            className={cn(
              "rounded-full border border-border px-2 py-0.5",
              tones[k] === "info" && "bg-blue-500/10 text-blue-300",
              tones[k] === "warn" && "bg-yellow-500/10 text-yellow-300",
              tones[k] === "danger" && "bg-red-500/10 text-red-300",
              tones[k] === "success" && "bg-green-500/10 text-green-300",
            )}
          >
            {k} · {n}
          </span>
        ))}
      </div>
    </Card>
  );
}

function runTone(
  status: string,
): "neutral" | "info" | "warn" | "danger" | "success" {
  if (status === "running" || status === "in_progress") return "info";
  if (status === "succeeded" || status === "done") return "success";
  if (status === "failed" || status === "errored") return "danger";
  if (status === "cancelled") return "neutral";
  return "neutral";
}
