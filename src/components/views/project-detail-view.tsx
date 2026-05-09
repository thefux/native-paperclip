import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Briefcase,
  ClipboardList,
  Coins,
  FileText,
  ListChecks,
  Settings as SettingsIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { projectsApi } from "@/lib/api/agents";
import { issuesApi } from "@/lib/api/issues";
import { budgetsApi } from "@/lib/api/budgets";
import { Badge, Button, Card } from "@/components/ui";
import { cn, formatRelativeTime } from "@/lib/utils";
import type {
  BudgetPolicySummary,
  InboxIssue,
  IssuePriority,
  IssueStatus,
  Project,
  ProjectWorkspace,
} from "@/lib/api/types";

/**
 * Project detail page (Phase E1 / [ROU-102](/ROU/issues/ROU-102)).
 *
 * Five sub-tabs — Overview, Issues, Workspaces, Configuration, Budget — driven
 * by `useProjectsSubroute`. Mobile (sm + md) renders a horizontal scrolling
 * pill strip below the header; desktop (lg+) renders the same tab strip but
 * inline in the right pane (we deliberately don't use a left rail here so the
 * detail page reads as one connected page on every breakpoint, matching the
 * web `/projects/:id/{tab}` layout).
 *
 * Edit / Archive header actions are visual stubs in E1 — the writable
 * configuration UI lands in Phase E2 once we agree on the approval shape with
 * backend. They're labelled `Phase E2` so reviewers can see the gap.
 */
export type ProjectDetailSub =
  | "overview"
  | "issues"
  | "workspaces"
  | "configuration"
  | "budget";

const VALID_SUBS = new Set<string>([
  "overview",
  "issues",
  "workspaces",
  "configuration",
  "budget",
]);

export function isValidProjectDetailSub(id: string | null): id is ProjectDetailSub {
  return id !== null && VALID_SUBS.has(id);
}

const TABS: ReadonlyArray<{ id: ProjectDetailSub; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "issues", label: "Issues", icon: ListChecks },
  { id: "workspaces", label: "Workspaces", icon: Briefcase },
  { id: "configuration", label: "Configuration", icon: SettingsIcon },
  { id: "budget", label: "Budget", icon: Coins },
];

const STATUS_TONE: Record<string, "neutral" | "info" | "warn" | "danger" | "success"> = {
  planned: "neutral",
  in_progress: "info",
  paused: "warn",
  completed: "success",
  archived: "neutral",
};

const ISSUE_STATUS_TONE: Record<IssueStatus, "neutral" | "info" | "warn" | "danger" | "success"> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "info",
  in_review: "warn",
  blocked: "danger",
  done: "success",
  cancelled: "neutral",
};

const ISSUE_PRIORITY_TONE: Record<IssuePriority, "neutral" | "info" | "warn" | "danger"> = {
  critical: "danger",
  high: "warn",
  medium: "info",
  low: "neutral",
};

export function ProjectDetailView({
  projectId,
  sub,
  onSubChange,
  onBack,
  onOpenIssue,
}: {
  projectId: string;
  sub: ProjectDetailSub;
  onSubChange: (sub: ProjectDetailSub) => void;
  onBack: () => void;
  onOpenIssue: (issueId: string) => void;
}) {
  const { client, prefix } = useActiveClient();

  const project = useQuery<Project | null>({
    queryKey: [prefix, "project", projectId] as const,
    queryFn: () =>
      client ? projectsApi.get(client, projectId) : Promise.resolve(null),
    enabled: !!client && !!projectId,
    retry: false,
  });

  if (!client) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ProjectDetailHeader
        project={project.data ?? null}
        loading={project.isLoading}
        onBack={onBack}
      />

      {project.isError ? (
        <div className="p-4 text-sm text-red-300">
          {(project.error as Error)?.message ?? "Failed to load project."}
        </div>
      ) : (
        <>
          <TabStrip activeId={sub} onSelect={onSubChange} />
          <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {sub === "overview" && (
              <OverviewTab project={project.data ?? null} loading={project.isLoading} />
            )}
            {sub === "issues" && (
              <IssuesTab projectId={projectId} onOpenIssue={onOpenIssue} />
            )}
            {sub === "workspaces" && (
              <WorkspacesTab project={project.data ?? null} loading={project.isLoading} />
            )}
            {sub === "configuration" && (
              <ConfigurationTab project={project.data ?? null} loading={project.isLoading} />
            )}
            {sub === "budget" && (
              <BudgetTab projectId={projectId} project={project.data ?? null} />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ProjectDetailHeader({
  project,
  loading,
  onBack,
}: {
  project: Project | null;
  loading: boolean;
  onBack: () => void;
}) {
  const status = project?.status ?? null;
  const tone = status ? (STATUS_TONE[status] ?? "neutral") : "neutral";
  return (
    <header className="flex items-start gap-3 border-b border-border bg-surface px-4 py-3">
      <Button
        variant="ghost"
        onClick={onBack}
        aria-label="Back to projects list"
        className="mt-0.5 px-2"
      >
        <ArrowLeft size={16} />
      </Button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {loading && !project ? (
            <div className="h-5 w-40 animate-pulse rounded bg-border/40" />
          ) : (
            <h1 className="truncate text-base font-semibold">
              {project?.name ?? "Project"}
            </h1>
          )}
          {status && <Badge tone={tone}>{status}</Badge>}
          {project?.archivedAt && <Badge tone="neutral">archived</Badge>}
        </div>
        {project?.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted">{project.description}</p>
        ) : (
          <p className="mt-0.5 truncate text-[11px] text-muted">
            {project?.urlKey ? `${project.urlKey} · ` : ""}
            <span className="font-mono">{project?.id ?? ""}</span>
          </p>
        )}
      </div>
      <div className="hidden items-center gap-1 sm:flex">
        <Button variant="ghost" disabled aria-label="Edit project (Phase E2)">
          Edit
          <span className="ml-1 text-[9px] uppercase text-muted">E2</span>
        </Button>
        <Button variant="ghost" disabled aria-label="Archive project (Phase E2)">
          Archive
          <span className="ml-1 text-[9px] uppercase text-muted">E2</span>
        </Button>
      </div>
    </header>
  );
}

function TabStrip({
  activeId,
  onSelect,
}: {
  activeId: ProjectDetailSub;
  onSelect: (id: ProjectDetailSub) => void;
}) {
  return (
    <nav
      aria-label="Project sections"
      className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border bg-bg/40 px-3 py-2"
      role="tablist"
    >
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs",
              active
                ? "border-accent bg-accent/15 text-fg"
                : "border-border bg-bg text-muted hover:text-fg",
            )}
          >
            <Icon size={12} aria-hidden />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

function OverviewTab({
  project,
  loading,
}: {
  project: Project | null;
  loading: boolean;
}) {
  const { client, prefix, companyId } = useActiveClient();

  // Reuse the same react-query key as IssuesTab so navigating between tabs
  // doesn't double-fetch. Counts and recent activity are derived locally.
  const issues = useQuery<InboxIssue[]>({
    queryKey: [prefix, "project-issues", project?.id, "all"] as const,
    queryFn: async () => {
      if (!client || !companyId || !project) return [];
      return issuesApi.list(client, companyId, {
        projectId: project.id,
        includeTerminal: true,
        limit: 500,
      });
    },
    enabled: !!client && !!companyId && !!project,
    retry: false,
  });

  const counts = useMemo(() => {
    const all = issues.data ?? [];
    const open = all.filter(
      (i) => i.status !== "done" && i.status !== "cancelled",
    ).length;
    const done = all.filter((i) => i.status === "done").length;
    const recent = [...all]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 5);
    return { total: all.length, open, done, recent };
  }, [issues.data]);

  if (loading && !project) {
    return <TabSkeleton />;
  }
  if (!project) {
    return <EmptyTab message="Project not found." />;
  }

  const workspaceCount = project.workspaces?.length ?? 0;

  return (
    <div className="space-y-4 p-4">
      {project.description && (
        <Card className="space-y-1">
          <h2 className="text-xs uppercase tracking-wide text-muted">Description</h2>
          <p className="whitespace-pre-wrap text-sm">{project.description}</p>
        </Card>
      )}

      {project.goals && project.goals.length > 0 && (
        <Card className="space-y-2">
          <h2 className="text-xs uppercase tracking-wide text-muted">Goals</h2>
          <ul className="space-y-1 text-sm">
            {project.goals.map((g) => (
              <li key={g.id} className="flex items-center gap-2">
                <ClipboardList size={12} aria-hidden className="text-muted" />
                <span className="truncate">{g.title}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard label="Open issues" value={counts.open} loading={issues.isLoading} />
        <CountCard label="Done" value={counts.done} loading={issues.isLoading} />
        <CountCard label="Workspaces" value={workspaceCount} />
        <CountCard label="Total issues" value={counts.total} loading={issues.isLoading} />
      </div>

      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wide text-muted">Recent activity</h2>
          {!issues.isLoading && (
            <span className="text-[11px] text-muted">
              top {counts.recent.length} by updated time
            </span>
          )}
        </div>
        {issues.isLoading && <p className="text-sm text-muted">Loading…</p>}
        {issues.isError && (
          <p className="text-xs text-yellow-300">
            Activity unavailable: {(issues.error as Error).message}
          </p>
        )}
        {!issues.isLoading && !issues.isError && counts.recent.length === 0 && (
          <p className="text-sm text-muted">No issues attached to this project yet.</p>
        )}
        <ul className="space-y-1">
          {counts.recent.map((issue) => (
            <li
              key={issue.id}
              className="flex items-center gap-2 rounded border border-border/40 bg-bg/40 px-2 py-1.5 text-xs"
            >
              <span className="font-mono text-muted">{issue.identifier}</span>
              <Badge tone={ISSUE_STATUS_TONE[issue.status]}>{issue.status}</Badge>
              <span className="truncate">{issue.title}</span>
              <span className="ml-auto text-muted">
                {formatRelativeTime(issue.updatedAt)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function CountCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | undefined;
  loading?: boolean;
}) {
  return (
    <Card className="space-y-1 text-center">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">
        {loading ? "…" : (value ?? 0)}
      </div>
    </Card>
  );
}

function IssuesTab({
  projectId,
  onOpenIssue,
}: {
  projectId: string;
  onOpenIssue: (issueId: string) => void;
}) {
  const { client, prefix, companyId } = useActiveClient();

  const issues = useQuery<InboxIssue[]>({
    queryKey: [prefix, "project-issues", projectId, "all"] as const,
    queryFn: async () => {
      if (!client || !companyId) return [];
      return issuesApi.list(client, companyId, {
        projectId,
        includeTerminal: true,
        limit: 500,
      });
    },
    enabled: !!client && !!companyId,
  });

  const [statusFilter, setStatusFilter] = useState<IssueStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | "all">("all");

  const filtered = useMemo(() => {
    const data = issues.data ?? [];
    return data.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (priorityFilter !== "all" && i.priority !== priorityFilter) return false;
      return true;
    });
  }, [issues.data, statusFilter, priorityFilter]);

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <FilterPills
          label="Status"
          value={statusFilter}
          options={[
            { value: "all", label: "All" },
            { value: "todo", label: "Todo" },
            { value: "in_progress", label: "In progress" },
            { value: "in_review", label: "Review" },
            { value: "blocked", label: "Blocked" },
            { value: "done", label: "Done" },
          ]}
          onChange={(v) => setStatusFilter(v as IssueStatus | "all")}
        />
        <FilterPills
          label="Priority"
          value={priorityFilter}
          options={[
            { value: "all", label: "All" },
            { value: "critical", label: "Critical" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
          onChange={(v) => setPriorityFilter(v as IssuePriority | "all")}
        />
        <span className="ml-auto text-[11px] text-muted">
          {issues.isLoading
            ? "loading…"
            : `${filtered.length} of ${issues.data?.length ?? 0}`}
        </span>
      </div>

      {issues.isLoading && <p className="text-sm text-muted">Loading issues…</p>}
      {issues.isError && (
        <Card>
          <p className="text-sm text-red-300">
            Failed to load issues: {(issues.error as Error).message}
          </p>
        </Card>
      )}
      {!issues.isLoading && !issues.isError && filtered.length === 0 && (
        <Card>
          <p className="text-sm text-muted">
            {issues.data?.length === 0
              ? "No issues attached to this project yet."
              : "No issues match the current filters."}
          </p>
        </Card>
      )}

      <ul className="divide-y divide-border/40 rounded-md border border-border bg-surface text-sm">
        {filtered.map((issue) => (
          <li key={issue.id}>
            <IssueRow issue={issue} onOpen={() => onOpenIssue(issue.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Compact row primitive for the project Issues sub-tab. Same column rhythm as
 * the Inbox row but lives here instead of being extracted into a shared
 * primitive — when Phase E2 / F adopt the same shape we can hoist it; for now
 * a duplicate of ~6 visual lines is cheaper than a premature abstraction.
 */
function IssueRow({
  issue,
  onOpen,
}: {
  issue: InboxIssue;
  onOpen: () => void;
}) {
  const priorityTone = ISSUE_PRIORITY_TONE[issue.priority] ?? "neutral";
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-border/30"
    >
      <span className="font-mono text-xs text-muted">{issue.identifier}</span>
      <Badge tone={ISSUE_STATUS_TONE[issue.status]}>{issue.status}</Badge>
      <Badge tone={priorityTone} className="hidden sm:inline-flex">
        {issue.priority}
      </Badge>
      <span className="min-w-0 flex-1 truncate">{issue.title}</span>
      <span className="ml-auto text-xs text-muted">
        {formatRelativeTime(issue.updatedAt)}
      </span>
    </button>
  );
}

function FilterPills<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px]",
            value === o.value
              ? "border-accent bg-accent/15 text-fg"
              : "border-border bg-bg text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function WorkspacesTab({
  project,
  loading,
}: {
  project: Project | null;
  loading: boolean;
}) {
  if (loading && !project) return <TabSkeleton />;
  if (!project) return <EmptyTab message="Project not found." />;

  const workspaces = project.workspaces ?? [];
  if (workspaces.length === 0) {
    return (
      <EmptyTab
        message="No workspaces attached to this project yet."
        hint="Workspaces appear here once you attach a git repo or local folder to the project."
      />
    );
  }

  return (
    <div className="space-y-3 p-4">
      <ul className="space-y-2">
        {workspaces.map((w) => (
          <WorkspaceCard key={w.id} workspace={w} />
        ))}
      </ul>
      <p className="text-[11px] text-muted">
        Workspace details land in Phase F.
      </p>
    </div>
  );
}

function WorkspaceCard({ workspace }: { workspace: ProjectWorkspace }) {
  const kind = workspace.repoUrl
    ? "git_repo"
    : workspace.cwd
      ? "cwd"
      : (workspace.sourceType ?? "—");
  return (
    <Card className="space-y-1">
      <div className="flex items-center gap-2">
        <Briefcase size={14} aria-hidden className="text-muted" />
        <span className="text-sm font-medium">{workspace.name}</span>
        {workspace.isPrimary && <Badge tone="info">primary</Badge>}
        <span className="ml-auto text-[11px] text-muted">
          {workspace.updatedAt ? formatRelativeTime(workspace.updatedAt) : ""}
        </span>
      </div>
      <div className="text-xs text-muted">
        <span className="font-mono">{kind}</span>
        {workspace.repoUrl && (
          <>
            {" · "}
            <span className="break-all">{workspace.repoUrl}</span>
          </>
        )}
        {workspace.cwd && (
          <>
            {" · "}
            <span className="font-mono">{workspace.cwd}</span>
          </>
        )}
      </div>
    </Card>
  );
}

function ConfigurationTab({
  project,
  loading,
}: {
  project: Project | null;
  loading: boolean;
}) {
  if (loading && !project) return <TabSkeleton />;
  if (!project) return <EmptyTab message="Project not found." />;

  const goalLabel =
    project.goals && project.goals.length > 0
      ? project.goals.map((g) => g.title).join(", ")
      : (project.goalId ?? "—");

  return (
    <div className="space-y-3 p-4">
      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs uppercase tracking-wide text-muted">Settings</h2>
          <Badge tone="neutral" className="ml-auto text-[9px] uppercase">
            E2 read-only
          </Badge>
        </div>
        <KV k="Name" v={project.name} />
        <KV k="Description" v={project.description ?? "—"} multiline />
        <KV k="Status" v={project.status ?? "—"} />
        <KV k="URL key" v={project.urlKey ?? "—"} />
        <KV k="Goal" v={goalLabel} />
        <KV k="Billing code" v={project.billingCode ?? "—"} />
        <KV k="Lead agent" v={project.leadAgentId ?? "—"} />
        <KV k="Target date" v={project.targetDate ?? "—"} />
        <KV
          k="Archived"
          v={project.archivedAt ? `at ${formatRelativeTime(project.archivedAt)}` : "no"}
        />
        {project.pauseReason && (
          <KV k="Pause reason" v={`${project.pauseReason}${project.pausedAt ? ` (${formatRelativeTime(project.pausedAt)})` : ""}`} />
        )}
      </Card>

      {project.codebase && (
        <Card className="space-y-2">
          <h2 className="text-xs uppercase tracking-wide text-muted">Codebase</h2>
          <KV k="Repo URL" v={project.codebase.repoUrl ?? "—"} />
          <KV k="Repo ref" v={project.codebase.repoRef ?? "—"} />
          <KV k="Default ref" v={project.codebase.defaultRef ?? "—"} />
          <KV k="Local folder" v={project.codebase.effectiveLocalFolder ?? project.codebase.managedFolder ?? "—"} />
          <KV k="Origin" v={project.codebase.origin ?? "—"} />
        </Card>
      )}
    </div>
  );
}

function BudgetTab({
  projectId,
  project,
}: {
  projectId: string;
  project: Project | null;
}) {
  const { client, prefix, companyId } = useActiveClient();

  const overview = useQuery({
    queryKey: [prefix, "budget-overview", companyId] as const,
    queryFn: () =>
      client && companyId
        ? budgetsApi.overview(client, companyId)
        : Promise.resolve(null),
    enabled: !!client && !!companyId,
    retry: false,
  });

  const projectPolicies = useMemo<BudgetPolicySummary[]>(
    () =>
      (overview.data?.policies ?? []).filter(
        (p) => p.scopeType === "project" && p.scopeId === projectId,
      ),
    [overview.data, projectId],
  );

  if (overview.isLoading) {
    return (
      <div className="p-4 text-sm text-muted">Loading budget…</div>
    );
  }
  if (overview.isError) {
    return (
      <div className="p-4 text-sm text-red-300">
        Failed to load budget overview: {(overview.error as Error).message}
      </div>
    );
  }
  if (projectPolicies.length === 0) {
    return (
      <EmptyTab
        message="No budget policy attached to this project."
        hint={
          project?.pauseReason === "budget"
            ? "Project is paused for budget reasons but no scoped policy is configured."
            : "Add a budget policy from the web /companies → Budgets page (Phase E2 will surface this in-app)."
        }
      />
    );
  }

  return (
    <div className="space-y-3 p-4">
      {projectPolicies.map((p) => (
        <BudgetPolicyCard key={p.policyId} policy={p} />
      ))}
    </div>
  );
}

function BudgetPolicyCard({ policy }: { policy: BudgetPolicySummary }) {
  const tone =
    policy.status === "hard_stop"
      ? "danger"
      : policy.status === "warning"
        ? "warn"
        : "success";
  const utilization = Math.max(0, Math.min(100, policy.utilizationPercent));
  const fillTone =
    policy.status === "hard_stop"
      ? "bg-red-500/70"
      : policy.status === "warning"
        ? "bg-yellow-500/70"
        : "bg-green-500/70";

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">
          {policy.metric} · {policy.windowKind}
        </h3>
        <Badge tone={tone}>{policy.status}</Badge>
        {policy.paused && <Badge tone="warn">paused</Badge>}
        <span className="ml-auto text-[11px] text-muted">
          {formatMoney(policy.observedAmount)} / {formatMoney(policy.amount)}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-border/40"
        role="progressbar"
        aria-valuenow={utilization}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full transition-all", fillTone)}
          style={{ width: `${utilization}%` }}
        />
      </div>
      <div className="grid gap-2 text-xs sm:grid-cols-3">
        <KV k="Used" v={formatMoney(policy.observedAmount)} />
        <KV k="Remaining" v={formatMoney(policy.remainingAmount)} />
        <KV k="Utilization" v={`${utilization.toFixed(1)}%`} />
        {policy.warnPercent !== undefined && (
          <KV k="Warn at" v={`${policy.warnPercent}%`} />
        )}
        <KV
          k="Hard stop"
          v={policy.hardStopEnabled ? "enabled" : "off"}
        />
        <KV
          k="Window"
          v={
            policy.windowStart && policy.windowEnd
              ? `${formatDate(policy.windowStart)} → ${formatDate(policy.windowEnd)}`
              : policy.windowKind
          }
        />
      </div>
    </Card>
  );
}

function formatMoney(amountCents: number): string {
  // Server stores money as integer cents.
  const dollars = amountCents / 100;
  return dollars.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: dollars >= 100 ? 0 : 2,
  });
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

function KV({
  k,
  v,
  multiline,
}: {
  k: string;
  v?: string | number | null;
  multiline?: boolean;
}) {
  if (v === undefined || v === null || v === "") return null;
  return (
    <div className={cn("flex gap-2 text-xs", multiline && "items-start")}>
      <span className="min-w-[7rem] text-muted">{k}</span>
      <span
        className={cn(
          "flex-1 break-words",
          multiline ? "whitespace-pre-wrap" : "font-mono",
        )}
      >
        {String(v)}
      </span>
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <div className="h-20 animate-pulse rounded-lg bg-border/30" />
      <div className="h-32 animate-pulse rounded-lg bg-border/30" />
      <div className="h-32 animate-pulse rounded-lg bg-border/30" />
    </div>
  );
}

function EmptyTab({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex h-full items-start justify-center overflow-y-auto p-6">
      <Card className="w-full max-w-md space-y-1 text-center">
        <p className="text-sm">{message}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </Card>
    </div>
  );
}
