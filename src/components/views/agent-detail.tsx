import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  PauseCircle,
  Pencil,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { agentsApi } from "@/lib/api/agents";
import { Badge, Button, Card } from "@/components/ui";
import { cn, formatRelativeTime } from "@/lib/utils";
import { isMobileShell, useBreakpoint } from "@/lib/use-breakpoint";
import type {
  AgentDetail as AgentDetailType,
  AgentRun,
  AgentSummary,
} from "@/lib/api/types";
import type { AgentDetailSection } from "@/lib/use-agents-route";
import { RunTranscript } from "@/components/views/run-transcript";

const SECTIONS: ReadonlyArray<{ id: AgentDetailSection; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "runs", label: "Runs" },
  { id: "skills", label: "Skills" },
  { id: "budget", label: "Budget" },
];

/**
 * Agent detail page — Phase D1 / [ROU-101](/ROU/issues/ROU-101) §2.
 *
 * Drilldown surface mounted at `#agents/{agentId}` with four sub-tabs. The
 * Runs tab opens a third-pane transcript (`<RunTranscript>`) on desktop, or
 * pushes a full-screen view on mobile via the URL `#agents/{id}/runs/{runId}`.
 *
 * Header actions (Edit, Pause/Resume) are visual placeholders — the wiring
 * lands in Phase D2 alongside the hire flow. We tag them with `aria-disabled`
 * so screen readers don't promise interactivity that isn't there yet.
 */
export function AgentDetail({
  agentId,
  section,
  runId,
  onSectionChange,
  onOpenRun,
  onCloseRun,
  onBack,
}: {
  agentId: string;
  section: AgentDetailSection;
  runId: string | null;
  onSectionChange: (s: AgentDetailSection) => void;
  onOpenRun: (runId: string) => void;
  onCloseRun: () => void;
  onBack: () => void;
}) {
  const { client, prefix, companyId } = useActiveClient();
  const bp = useBreakpoint();
  const isMobile = isMobileShell(bp);

  const detailQuery = useQuery<AgentDetailType | null>({
    queryKey: [prefix, "agent", agentId] as const,
    queryFn: () => (client ? agentsApi.get(client, agentId) : Promise.resolve(null)),
    enabled: !!client,
    retry: false,
  });

  // The third-pane transcript only renders at lg+ where we have horizontal
  // room. Below lg (md/sm or short desktop windows) the transcript fills the
  // pane via a full-screen push (UIUXLead review note 2 — at the lg floor
  // the runs list pane was getting squeezed). Mobile push-back is handled by
  // the URL drilldown so the OS back gesture pops the run id off the stack.
  const showThirdPane = !isMobile && !!runId;
  if (isMobile && runId) {
    return (
      <RunTranscript
        runId={runId}
        agentName={detailQuery.data?.name ?? null}
        onClose={onCloseRun}
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <DetailHeader
        agent={detailQuery.data}
        loading={detailQuery.isLoading}
        onBack={onBack}
        onRefresh={() => detailQuery.refetch()}
        refreshing={detailQuery.isFetching}
      />
      <SectionTabs
        active={section}
        onSelect={onSectionChange}
        skillsCount={detailQuery.data?.skills?.length}
      />

      <div className={cn("flex min-h-0 flex-1", !isMobile && "flex-row")}>
        <section className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto pl-safe pr-safe")}>
          {detailQuery.isLoading ? (
            <SkeletonBody />
          ) : detailQuery.isError ? (
            <ErrorState
              message={(detailQuery.error as Error).message}
              onRetry={() => detailQuery.refetch()}
            />
          ) : !detailQuery.data ? (
            <div className="p-6 text-sm text-muted">Agent not found.</div>
          ) : (
            <SectionBody
              agent={detailQuery.data}
              section={section}
              companyId={companyId}
              onOpenRun={onOpenRun}
              activeRunId={runId}
            />
          )}
        </section>

        {showThirdPane && (
          <aside className="w-[clamp(360px,38%,460px)] shrink-0 border-l border-border bg-bg/60">
            <RunTranscript
              runId={runId}
              agentName={detailQuery.data?.name ?? null}
              onClose={onCloseRun}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function DetailHeader({
  agent,
  loading,
  onBack,
  onRefresh,
  refreshing,
}: {
  agent: AgentDetailType | null | undefined;
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <header className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
      <Button
        variant="ghost"
        onClick={onBack}
        aria-label="Back to agents list"
        className="px-2 py-0.5 text-xs"
      >
        <ArrowLeft size={14} className="mr-1" />
        Back
      </Button>
      <div className="min-w-0 flex-1">
        {loading ? (
          <div className="space-y-1">
            <div className="h-4 w-32 animate-pulse rounded bg-border/60" />
            <div className="h-3 w-44 animate-pulse rounded bg-border/40" />
          </div>
        ) : agent ? (
          <>
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold">{agent.name}</h1>
              {/* Role stays neutral so `tone="info"` etc. remains reserved for the
                  status pill (UIUXLead review note 4 — two info badges side-by-side
                  blurred their meanings). */}
              {agent.role && <Badge tone="neutral">{agent.role}</Badge>}
              <StatusPill agent={agent} />
            </div>
            {agent.title && (
              <p className="truncate text-[11px] text-muted">{agent.title}</p>
            )}
          </>
        ) : null}
      </div>
      <Button
        variant="ghost"
        onClick={onRefresh}
        aria-label="Refresh"
        className="px-2 py-0.5 text-xs"
        disabled={refreshing}
      >
        <RefreshCw size={12} className={cn("mr-1", refreshing && "animate-spin")} />
        Refresh
      </Button>
      {/* TODO Phase D2: wire Edit and Pause/Resume to the agent admin endpoints.
          The buttons are real `<Button disabled>` so keyboard focus skips them
          (UIUXLead review note 6 — `aria-disabled` alone left them tab-stoppable). */}
      <Button
        variant="ghost"
        disabled
        title="Edit (Phase D2)"
        className="px-2 py-0.5 text-xs opacity-60"
      >
        <Pencil size={12} className="mr-1" />
        Edit
      </Button>
      <PauseResumeButton agent={agent ?? null} />
    </header>
  );
}

function PauseResumeButton({ agent }: { agent: AgentDetailType | null }) {
  const paused = !!agent?.pausedAt;
  // TODO Phase D2: POST /api/agents/:id/pause and resume; surface error toast.
  return (
    <Button
      variant="ghost"
      disabled
      title={paused ? "Resume (Phase D2)" : "Pause (Phase D2)"}
      className="px-2 py-0.5 text-xs opacity-60"
    >
      {paused ? (
        <PlayCircle size={12} className="mr-1" />
      ) : (
        <PauseCircle size={12} className="mr-1" />
      )}
      {paused ? "Resume" : "Pause"}
    </Button>
  );
}

function StatusPill({ agent }: { agent: AgentSummary }) {
  if (agent.status === "error" || agent.status === "errored") {
    return <Badge tone="danger">error</Badge>;
  }
  if (agent.pausedAt) return <Badge tone="warn">paused</Badge>;
  if (agent.status === "running") return <Badge tone="info">running</Badge>;
  return <Badge tone="success">{agent.status ?? "active"}</Badge>;
}

function SectionTabs({
  active,
  onSelect,
  skillsCount,
}: {
  active: AgentDetailSection;
  onSelect: (s: AgentDetailSection) => void;
  /** Skills are loaded with the agent record, so the count is cheap to surface. */
  skillsCount?: number;
}) {
  // role="tablist" wraps tabs so the W3C tab pattern parses correctly
  // (UIUXLead review note 5).
  return (
    <nav
      role="tablist"
      aria-label="Agent detail sections"
      className="flex gap-1.5 overflow-x-auto border-b border-border bg-bg/40 px-3 py-2"
    >
      {SECTIONS.map((s) => {
        const isActive = s.id === active;
        // Runs count would need an extra fetch we don't want to pay on every
        // detail open; the Runs tab body already shows the loaded count once
        // selected.
        const count = s.id === "skills" ? skillsCount : undefined;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(s.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs",
              isActive
                ? "border-accent bg-accent/15 text-fg"
                : "border-border bg-bg text-muted hover:text-fg",
            )}
          >
            <span>{s.label}</span>
            {count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-mono",
                  isActive ? "bg-accent/30 text-fg" : "bg-border/40 text-muted",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function SectionBody({
  agent,
  section,
  companyId,
  onOpenRun,
  activeRunId,
}: {
  agent: AgentDetailType;
  section: AgentDetailSection;
  companyId: string | null | undefined;
  onOpenRun: (runId: string) => void;
  activeRunId: string | null;
}) {
  if (section === "overview") return <OverviewSection agent={agent} />;
  if (section === "runs") {
    return (
      <RunsSection
        agentId={agent.id}
        companyId={companyId ?? agent.companyId ?? null}
        onOpenRun={onOpenRun}
        activeRunId={activeRunId}
      />
    );
  }
  if (section === "skills") return <SkillsSection agent={agent} />;
  return <BudgetSection agent={agent} />;
}

function OverviewSection({ agent }: { agent: AgentDetailType }) {
  return (
    <div className="space-y-3 p-4">
      {agent.description && (
        <Card className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted">About</div>
          <p className="text-sm">{agent.description}</p>
        </Card>
      )}
      {agent.capabilities && (
        <Card className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted">Capabilities</div>
          <p className="whitespace-pre-line text-sm text-muted">
            {agent.capabilities}
          </p>
        </Card>
      )}
      <Card className="space-y-1.5">
        <div className="text-xs uppercase tracking-wide text-muted">Identity</div>
        <KV k="Agent ID" v={agent.id} mono />
        {agent.companyId && <KV k="Company" v={agent.companyId} mono />}
        {agent.adapterType && <KV k="Adapter" v={agent.adapterType} />}
        <KV k="Status" v={agent.status ?? (agent.isActive === false ? "inactive" : "active")} />
        {agent.pausedAt && (
          <KV k="Paused" v={`${formatRelativeTime(agent.pausedAt)} (${agent.pauseReason ?? "no reason"})`} />
        )}
        {agent.lastHeartbeatAt && (
          <KV k="Last heartbeat" v={formatRelativeTime(agent.lastHeartbeatAt)} />
        )}
        {agent.instructionsPath !== undefined && (
          <KV k="Instructions" v={agent.instructionsPath ?? "—"} />
        )}
        {agent.reportsTo && <KV k="Reports to" v={agent.reportsTo} mono />}
        {agent.chainOfCommand && agent.chainOfCommand.length > 0 && (
          <KV
            k="Chain of command"
            v={agent.chainOfCommand.map((id) => id.slice(0, 8)).join(" → ")}
            mono
          />
        )}
      </Card>
    </div>
  );
}

function RunsSection({
  agentId,
  companyId,
  onOpenRun,
  activeRunId,
}: {
  agentId: string;
  companyId: string | null;
  onOpenRun: (runId: string) => void;
  activeRunId: string | null;
}) {
  const { client, prefix } = useActiveClient();

  const runs = useQuery<AgentRun[]>({
    queryKey: [prefix, "agent-runs", companyId, agentId] as const,
    queryFn: () =>
      client && companyId
        ? agentsApi.runs(client, companyId, agentId, { limit: 100 })
        : Promise.resolve([]),
    enabled: !!client && !!companyId,
    retry: false,
  });

  if (!companyId) {
    return (
      <div className="p-4 text-sm text-muted">
        No company in scope. Switch companies to load runs.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <header className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">Recent runs</h2>
        <span className="text-xs text-muted">
          ({runs.data?.length ?? 0})
        </span>
        <Button
          variant="ghost"
          onClick={() => runs.refetch()}
          className="ml-auto px-2 py-0.5 text-xs"
          disabled={runs.isFetching}
        >
          <RefreshCw
            size={12}
            className={cn("mr-1", runs.isFetching && "animate-spin")}
          />
          Refresh
        </Button>
      </header>

      {runs.isLoading && (
        <ul className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="h-12 animate-pulse rounded-md border border-border bg-bg/30"
            />
          ))}
        </ul>
      )}

      {runs.isError && (
        <ErrorState
          message={(runs.error as Error).message}
          onRetry={() => runs.refetch()}
        />
      )}

      {!runs.isLoading && !runs.isError && runs.data?.length === 0 && (
        <p className="text-sm text-muted">No runs recorded for this agent yet.</p>
      )}

      {!runs.isLoading && runs.data && runs.data.length > 0 && (
        <ul className="space-y-1.5">
          {runs.data.map((r) => (
            <RunRow
              key={r.id}
              run={r}
              active={r.id === activeRunId}
              onOpen={() => onOpenRun(r.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function RunRow({
  run,
  active,
  onOpen,
}: {
  run: AgentRun;
  active: boolean;
  onOpen: () => void;
}) {
  const summary =
    typeof run.resultJson?.summary === "string"
      ? run.resultJson.summary.split("\n")[0]
      : typeof run.resultJson?.result === "string"
        ? run.resultJson.result.split("\n")[0]
        : null;
  const startedAt = run.startedAt ?? run.createdAt ?? null;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-pressed={active}
        className={cn(
          "flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors",
          active
            ? "border-accent bg-accent/10"
            : "border-border bg-bg hover:bg-surface",
        )}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted">
              {run.id.slice(0, 8)}…
            </span>
            <Badge tone={runTone(run.status)}>{run.status}</Badge>
            {run.resultJson?.is_error && <Badge tone="danger">errored</Badge>}
            {run.invocationSource && (
              <span className="text-[10px] uppercase tracking-wide text-muted">
                {run.invocationSource}
              </span>
            )}
            <span className="ml-auto text-[10px] text-muted">
              {formatRelativeTime(run.finishedAt ?? startedAt)}
            </span>
          </div>
          {summary && (
            <p className="line-clamp-2 text-xs text-muted">{summary}</p>
          )}
        </div>
        <ChevronRight size={14} className="shrink-0 self-center text-muted" />
      </button>
    </li>
  );
}

function SkillsSection({ agent }: { agent: AgentDetailType }) {
  const skills = agent.skills ?? [];
  return (
    <div className="space-y-3 p-4">
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Skills</h2>
          <span className="text-xs text-muted">({skills.length})</span>
        </div>
        {skills.length === 0 ? (
          <p className="text-sm text-muted">
            No skills assigned to this agent yet.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <li key={s.id}>
                <Badge tone="neutral">{s.name}</Badge>
              </li>
            ))}
          </ul>
        )}
        {/* TODO Phase D2: add/remove skills from this view. */}
        <p className="text-[11px] text-muted">
          Add/remove skills lands in Phase D2.
        </p>
      </Card>
    </div>
  );
}

function BudgetSection({ agent }: { agent: AgentDetailType }) {
  const limit = agent.budgetMonthlyCents ?? agent.budgetLimitCents ?? 0;
  const spent = agent.spentMonthlyCents ?? agent.budgetUsedCents ?? 0;
  const utilization = limit > 0 ? Math.min(1, spent / limit) : 0;
  const overBudget = limit > 0 && spent >= limit;
  const nearBudget = limit > 0 && utilization >= 0.8 && !overBudget;
  return (
    <div className="space-y-3 p-4">
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Monthly budget</h2>
          {limit === 0 ? (
            <Badge tone="neutral">Uncapped</Badge>
          ) : overBudget ? (
            <Badge tone="danger">Over budget</Badge>
          ) : nearBudget ? (
            <Badge tone="warn">Near limit</Badge>
          ) : (
            <Badge tone="success">In budget</Badge>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">
            {formatDollars(spent)}
          </span>
          <span className="text-sm text-muted">
            / {limit > 0 ? formatDollars(limit) : "uncapped"}
          </span>
        </div>
        {limit > 0 && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-border/40">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                overBudget
                  ? "bg-red-500"
                  : nearBudget
                    ? "bg-yellow-500"
                    : "bg-green-500",
              )}
              style={{ width: `${utilization * 100}%` }}
            />
          </div>
        )}
        <p className="text-xs text-muted">
          {limit > 0
            ? `${Math.round(utilization * 100)}% of monthly budget used.`
            : "No monthly cap set — usage is unbounded."}
        </p>
        {/* TODO Phase D2: editing budget needs a board-only PATCH; surface inline. */}
      </Card>
    </div>
  );
}

function KV({
  k,
  v,
  mono,
}: {
  k: string;
  v?: string | number | null;
  mono?: boolean;
}) {
  if (v === undefined || v === null || v === "") return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="min-w-[7rem] text-muted">{k}</span>
      <span className={cn(mono && "font-mono")}>{String(v)}</span>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="p-4">
      <Card className="space-y-2 text-sm">
        <p className="text-red-300">{message}</p>
        <Button variant="ghost" onClick={onRetry}>
          <RefreshCw size={14} className="mr-1" /> Retry
        </Button>
      </Card>
    </div>
  );
}

function SkeletonBody() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-lg border border-border bg-bg/30"
        />
      ))}
    </div>
  );
}

function runTone(
  status: string,
): "neutral" | "info" | "warn" | "danger" | "success" {
  if (status === "running" || status === "in_progress") return "info";
  if (status === "queued") return "warn";
  if (status === "succeeded" || status === "done") return "success";
  if (status === "failed" || status === "errored") return "danger";
  if (status === "cancelled") return "neutral";
  return "neutral";
}

function formatDollars(cents: number): string {
  if (!Number.isFinite(cents)) return "$0";
  const dollars = cents / 100;
  if (Math.abs(dollars) < 1) return `$${dollars.toFixed(2)}`;
  return `$${dollars.toFixed(2)}`;
}
