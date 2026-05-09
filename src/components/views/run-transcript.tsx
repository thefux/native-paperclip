import { useQuery } from "@tanstack/react-query";
import { useActiveClient } from "@/lib/store/use-active-client";
import { runsApi } from "@/lib/api/agents";
import { Badge, Card } from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils";
import type { AgentRunDetail, RunTranscriptEntry } from "@/lib/api/types";
import { X } from "lucide-react";

/**
 * Read-only run transcript modal. Server response shape varies; we
 * pull whichever of `transcript` / `messages` / `events` is present
 * and render each entry as a card. The actual entry shape is loose,
 * so we render `body` if it's a string, otherwise pretty-print the
 * `payload` object.
 */
export function RunTranscript({
  runId,
  onClose,
}: {
  runId: string;
  onClose: () => void;
}) {
  const { client, prefix } = useActiveClient();

  const run = useQuery<AgentRunDetail | null>({
    queryKey: [prefix, "run", runId] as const,
    queryFn: () => (client ? runsApi.get(client, runId) : Promise.resolve(null)),
    enabled: !!client,
    retry: false,
  });

  const entries = pickEntries(run.data ?? null);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <Card className="flex w-full max-w-3xl flex-col gap-3 max-h-[90vh]">
        <header className="flex items-center gap-2">
          <h2 className="text-base font-semibold">
            Run <span className="font-mono text-sm text-muted">{runId.slice(0, 8)}…</span>
          </h2>
          {run.data && (
            <>
              <Badge tone={tone(run.data.status)}>{run.data.status}</Badge>
              {run.data.result && (
                <Badge tone={run.data.result === "success" ? "success" : "danger"}>
                  {run.data.result}
                </Badge>
              )}
              {run.data.startedAt && (
                <span className="text-xs text-muted">
                  started {formatRelativeTime(run.data.startedAt)}
                </span>
              )}
            </>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded p-1 text-muted hover:text-fg"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto rounded-md border border-border bg-bg/50 p-3">
          {run.isLoading && <p className="text-sm text-muted">Loading run…</p>}
          {run.isError && (
            <p className="text-sm text-red-400">{(run.error as Error).message}</p>
          )}
          {entries.length === 0 && run.data && !run.isLoading && (
            <p className="text-sm text-muted">No transcript on this run.</p>
          )}
          <ul className="space-y-2">
            {entries.map((e, idx) => (
              <li
                key={e.id ?? `${idx}-${e.createdAt ?? ""}`}
                className="rounded border border-border bg-surface p-2 text-xs"
              >
                <div className="mb-1 flex items-center gap-2 text-[11px] text-muted">
                  {e.role && <span className="font-medium uppercase">{e.role}</span>}
                  {e.type && (
                    <span className="font-mono">{e.type}</span>
                  )}
                  {e.createdAt && <span className="ml-auto">{e.createdAt}</span>}
                </div>
                {typeof e.body === "string" ? (
                  <pre className="whitespace-pre-wrap break-words font-mono">{e.body}</pre>
                ) : e.payload ? (
                  <pre className="whitespace-pre-wrap break-words font-mono">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                ) : (
                  <pre className="whitespace-pre-wrap break-words font-mono opacity-70">
                    {JSON.stringify(e, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}

function pickEntries(run: AgentRunDetail | null): RunTranscriptEntry[] {
  if (!run) return [];
  return run.transcript ?? run.messages ?? run.events ?? [];
}

function tone(status: string): "neutral" | "info" | "warn" | "danger" | "success" {
  if (status === "running" || status === "in_progress") return "info";
  if (status === "succeeded" || status === "done") return "success";
  if (status === "failed" || status === "errored") return "danger";
  if (status === "cancelled") return "neutral";
  return "neutral";
}
