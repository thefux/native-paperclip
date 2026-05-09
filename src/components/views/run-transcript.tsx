import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { runsApi } from "@/lib/api/agents";
import { Badge, Button, Card } from "@/components/ui";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { AgentRunDetail, RunTranscriptEntry } from "@/lib/api/types";

/**
 * Run transcript pane — Phase D1 / [ROU-101](/ROU/issues/ROU-101) §3.
 *
 * Always renders embedded inside its parent (third pane on desktop, full-screen
 * push on mobile / narrow viewports — `<AgentDetail>` chooses). The legacy
 * modal mode was removed in the UIUXLead review fixup since every call site
 * goes through the URL drilldown. If a future tab needs an ad-hoc transcript
 * popover, wrap this component in your own modal at the call site.
 *
 * Wire format: heartbeat events from `/api/heartbeat-runs/:id/events` carry
 * `eventType` / `stream` / `message` / `payload`. Older v1 transcripts used
 * `role` / `body`. We render whichever fields are present.
 */
export function RunTranscript({
  runId,
  agentName,
  onClose,
}: {
  runId: string;
  /** Optional breadcrumb shown next to the run id so a mobile push retains context. */
  agentName?: string | null;
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
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <Button
          variant="ghost"
          onClick={onClose}
          aria-label="Back"
          className="px-2 py-0.5 text-xs"
        >
          <ArrowLeft size={14} className="mr-1" />
          Back
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">
            Run{" "}
            <span className="font-mono text-xs text-muted">
              {runId.slice(0, 8)}…
            </span>
            {agentName && (
              <>
                <span className="text-muted"> · </span>
                <span className="text-sm font-normal text-muted">{agentName}</span>
              </>
            )}
          </h2>
          {run.data && (
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={tone(run.data.status)}>{run.data.status}</Badge>
              {run.data.resultJson?.is_error && (
                <Badge tone="danger">errored</Badge>
              )}
              {run.data.startedAt && (
                <span className="text-[11px] text-muted">
                  started {formatRelativeTime(run.data.startedAt)}
                </span>
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          onClick={() => run.refetch()}
          aria-label="Refresh transcript"
          className="px-2 py-0.5 text-xs"
          disabled={run.isFetching}
        >
          <RefreshCw
            size={12}
            className={cn("mr-1", run.isFetching && "animate-spin")}
          />
          Refresh
        </Button>
      </header>

      {run.data?.resultJson?.summary && (
        <div className="border-b border-border bg-bg/30 px-3 py-2">
          <p className="line-clamp-3 text-xs text-muted">
            {run.data.resultJson.summary}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        {run.isLoading && <p className="text-sm text-muted">Loading run…</p>}
        {run.isError && (
          <Card className="space-y-2 text-sm">
            <p className="text-red-300">{(run.error as Error).message}</p>
            <Button variant="ghost" onClick={() => run.refetch()}>
              <RefreshCw size={14} className="mr-1" /> Retry
            </Button>
          </Card>
        )}
        {entries.length === 0 && run.data && !run.isLoading && (
          <p className="text-sm text-muted">No transcript on this run.</p>
        )}
        <ul className="space-y-2">
          {entries.map((e, idx) => (
            <TranscriptEntry key={entryKey(e, idx)} entry={e} />
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Payloads bigger than this collapse by default to keep the pane scannable. */
const PAYLOAD_COLLAPSE_LINES = 8;
const PAYLOAD_COLLAPSE_CHARS = 600;

function TranscriptEntry({ entry }: { entry: RunTranscriptEntry }) {
  const label = entry.eventType ?? entry.type ?? entry.role ?? "event";
  const stream = entry.stream;
  const message = entry.message ?? (typeof entry.body === "string" ? entry.body : null);
  const payloadRendered = useMemo(() => {
    if (!entry.payload) return null;
    if (Object.keys(entry.payload).length === 0) return null;
    return JSON.stringify(entry.payload, null, 2);
  }, [entry.payload]);
  const payloadIsLarge = !!(
    payloadRendered &&
    (payloadRendered.length > PAYLOAD_COLLAPSE_CHARS ||
      payloadRendered.split("\n").length > PAYLOAD_COLLAPSE_LINES)
  );
  const [payloadOpen, setPayloadOpen] = useState(!payloadIsLarge);
  const fallbackBlob = useMemo(() => {
    if (message || payloadRendered || typeof entry.body === "string") return null;
    return JSON.stringify(entry, null, 2);
  }, [entry, message, payloadRendered]);

  return (
    <li className="rounded border border-border bg-surface p-2 text-xs">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
        {entry.role && (
          <span className="font-medium uppercase">{entry.role}</span>
        )}
        <span className="font-mono">{label}</span>
        {stream && stream !== "system" && (
          <Badge tone={stream === "stderr" ? "danger" : "neutral"}>{stream}</Badge>
        )}
        {entry.level && entry.level !== "info" && (
          <Badge tone={entry.level === "error" ? "danger" : "warn"}>
            {entry.level}
          </Badge>
        )}
        {entry.createdAt && (
          <span className="ml-auto">{formatRelativeTime(entry.createdAt)}</span>
        )}
      </div>
      {message && (
        <pre className="whitespace-pre-wrap break-words font-mono">{message}</pre>
      )}
      {!message && typeof entry.body === "string" && (
        <pre className="whitespace-pre-wrap break-words font-mono">{entry.body}</pre>
      )}
      {payloadRendered && (
        <div className="mt-1">
          {payloadIsLarge && (
            <button
              type="button"
              onClick={() => setPayloadOpen((o) => !o)}
              aria-expanded={payloadOpen}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-fg"
            >
              {payloadOpen ? (
                <ChevronDown size={12} aria-hidden />
              ) : (
                <ChevronRight size={12} aria-hidden />
              )}
              {payloadOpen ? "Hide payload" : "Show payload"}
              <span className="font-mono opacity-70">
                ({payloadRendered.split("\n").length} lines)
              </span>
            </button>
          )}
          {payloadOpen && (
            <pre className="mt-1 whitespace-pre-wrap break-words font-mono opacity-80">
              {payloadRendered}
            </pre>
          )}
        </div>
      )}
      {fallbackBlob && (
        <pre className="whitespace-pre-wrap break-words font-mono opacity-70">
          {fallbackBlob}
        </pre>
      )}
    </li>
  );
}

function entryKey(e: RunTranscriptEntry, idx: number): string {
  if (e.id !== undefined) return `id-${e.id}`;
  const seq = e.seq;
  if (typeof seq === "number" || typeof seq === "string") return `seq-${seq}`;
  return `idx-${idx}-${e.createdAt ?? ""}`;
}

function pickEntries(run: AgentRunDetail | null): RunTranscriptEntry[] {
  if (!run) return [];
  return run.events ?? run.transcript ?? run.messages ?? [];
}

function tone(status: string): "neutral" | "info" | "warn" | "danger" | "success" {
  if (status === "running" || status === "in_progress") return "info";
  if (status === "queued") return "warn";
  if (status === "succeeded" || status === "done") return "success";
  if (status === "failed" || status === "errored") return "danger";
  if (status === "cancelled") return "neutral";
  return "neutral";
}
