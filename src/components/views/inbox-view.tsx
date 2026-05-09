
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Filter, Plus } from "lucide-react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { issuesApi } from "@/lib/api/issues";
import { projectsApi } from "@/lib/api/agents";
import { Badge, Button } from "@/components/ui";
import { IssueCreateForm } from "@/components/issue-create-form";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { InboxIssue, IssuePriority, IssueStatus, Project } from "@/lib/api/types";

const STATUS_TONE: Record<IssueStatus, "neutral" | "info" | "warn" | "danger" | "success"> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "info",
  in_review: "warn",
  blocked: "danger",
  done: "success",
  cancelled: "neutral",
};

const PRIORITY_TONE: Record<IssuePriority, "neutral" | "info" | "warn" | "danger" | "success"> = {
  critical: "danger",
  high: "warn",
  medium: "info",
  low: "neutral",
};

const STATUS_FILTERS: IssueStatus[] = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
];

type AssigneeScope = "me" | "company";

export function InboxView({
  onOpen,
  openId,
}: {
  onOpen: (id: string) => void;
  openId: string | null;
}) {
  const { instance, client, prefix } = useActiveClient();
  const companyId = instance?.defaultCompanyId ?? instance?.identity?.companyId ?? "";
  const myAgentId = instance?.identity?.id ?? "";

  const [scope, setScope] = useState<AssigneeScope>("me");
  const [statusFilter, setStatusFilter] = useState<IssueStatus[] | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);

  const isFiltered = scope === "company" || statusFilter !== null || !!projectId;

  // Inbox-lite for the unfiltered "me" path: cheaper, server-side scoped to me.
  const inboxLite = useQuery<InboxIssue[]>({
    queryKey: [prefix, "inbox"] as const,
    queryFn: async () => {
      if (!client) return [];
      return client.get<InboxIssue[]>("/api/agents/me/inbox-lite");
    },
    enabled: !!client && !isFiltered,
  });

  // Filtered query goes through the company-issues route.
  const filtered = useQuery<InboxIssue[]>({
    queryKey: [prefix, "inbox-filtered", scope, statusFilter ?? "default", projectId] as const,
    queryFn: async () => {
      if (!client || !companyId) return [];
      return issuesApi.list(client, companyId, {
        status: statusFilter ?? undefined,
        assigneeAgentId: scope === "me" ? myAgentId || undefined : undefined,
        projectId: projectId || undefined,
        limit: 50,
      });
    },
    enabled: !!client && !!companyId && isFiltered,
  });

  const projects = useQuery<Project[]>({
    queryKey: [prefix, "projects", companyId] as const,
    queryFn: () =>
      client && companyId ? projectsApi.list(client, companyId) : Promise.resolve([]),
    enabled: !!client && !!companyId,
    retry: false,
  });

  const issues = isFiltered ? filtered.data : inboxLite.data;
  const isLoading = isFiltered ? filtered.isLoading : inboxLite.isLoading;
  const error = isFiltered ? filtered.error : inboxLite.error;

  const visibleStatusFilter = useMemo(() => statusFilter ?? [], [statusFilter]);

  if (!client) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-muted">Inbox</span>
        <Button
          variant="ghost"
          className="ml-auto px-2 py-0.5 text-xs"
          onClick={() => setShowCreate(true)}
          title="Create issue (N)"
        >
          <Plus size={12} className="mr-1" />
          New
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-1.5 text-xs">
        <Filter size={12} className="text-muted" />
        <FilterChip
          label="Mine"
          active={scope === "me"}
          onClick={() => setScope("me")}
        />
        <FilterChip
          label="All in company"
          active={scope === "company"}
          onClick={() => setScope("company")}
        />
        <span className="mx-1 text-muted">·</span>
        <FilterChip
          label="Active"
          active={statusFilter === null}
          onClick={() => setStatusFilter(null)}
        />
        {STATUS_FILTERS.map((s) => (
          <FilterChip
            key={s}
            label={s}
            active={visibleStatusFilter.length === 1 && visibleStatusFilter[0] === s}
            onClick={() => setStatusFilter([s])}
          />
        ))}
        {projects.data && projects.data.length > 0 && (
          <>
            <span className="mx-1 text-muted">·</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="rounded border border-border bg-bg px-1.5 py-0.5 text-xs"
            >
              <option value="">all projects</option>
              {projects.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <ul className="flex-1 overflow-y-auto">
        {isLoading && <li className="p-3 text-sm text-muted">Loading…</li>}
        {error && (
          <li className="p-3 text-sm text-red-400">{(error as Error).message}</li>
        )}
        {issues?.length === 0 && (
          <li className="p-3 text-sm text-muted">
            {isFiltered ? "No issues match these filters." : "Inbox is empty."}
          </li>
        )}
        {issues?.map((issue) => (
          <li key={issue.id}>
            <button
              onClick={() => onOpen(issue.id)}
              className={cn(
                "flex w-full flex-col items-start gap-1 border-b border-border/60 px-3 py-2 text-left hover:bg-surface",
                openId === issue.id && "bg-surface",
              )}
            >
              <div className="flex w-full items-center gap-2">
                <span className="font-mono text-xs text-muted">{issue.identifier}</span>
                <Badge tone={STATUS_TONE[issue.status]}>{issue.status}</Badge>
                <Badge tone={PRIORITY_TONE[issue.priority]}>{issue.priority}</Badge>
                <span className="ml-auto text-xs text-muted">
                  {formatRelativeTime(issue.updatedAt)}
                </span>
              </div>
              <span className="line-clamp-2 text-sm">{issue.title}</span>
            </button>
          </li>
        ))}
      </ul>

      {showCreate && (
        <IssueCreateForm
          onClose={() => setShowCreate(false)}
          onCreated={(id) => onOpen(id)}
        />
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border border-border px-2 py-0.5 transition-colors",
        active ? "bg-accent/15 text-fg border-accent" : "text-muted hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}
