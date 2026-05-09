import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { ApiError } from "@/lib/api/client";
import { issuesApi, type CreateIssueInput } from "@/lib/api/issues";
import { agentsApi, goalsApi, projectsApi } from "@/lib/api/agents";
import { Button, Card, Input } from "@/components/ui";
import type { AgentSummary, Goal, IssuePriority, Project } from "@/lib/api/types";
import { X } from "lucide-react";

const PRIORITIES: IssuePriority[] = ["critical", "high", "medium", "low"];

export interface IssueCreateFormProps {
  /** When set, the new issue is created as a subtask of this parent. */
  parentId?: string | null;
  /** When set, the new issue inherits the execution workspace from this issue id. */
  inheritExecutionWorkspaceFromIssueId?: string | null;
  /** Pre-fill the title (for "duplicate" / "split" affordances). */
  initialTitle?: string;
  /** Closes the modal. The form calls this on cancel and on successful create. */
  onClose: () => void;
  /** Optional: called with the freshly created issue's id so a parent can navigate to it. */
  onCreated?: (issueId: string) => void;
}

/**
 * Modal that creates an issue against the active company. Surfaces title,
 * description, priority, assignee, project, goal, and parent. Defers the
 * billing-code / labels / blockers / status fields to the in-detail editor —
 * keeping create simple keeps it usable on a touch screen.
 */
export function IssueCreateForm({
  parentId,
  inheritExecutionWorkspaceFromIssueId,
  initialTitle,
  onClose,
  onCreated,
}: IssueCreateFormProps) {
  const { instance, client, prefix, companyId } = useActiveClient();
  const qc = useQueryClient();

  const [title, setTitle] = useState(initialTitle ?? "");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<IssuePriority>("medium");
  const [assigneeAgentId, setAssigneeAgentId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [goalId, setGoalId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const agents = useQuery<AgentSummary[]>({
    queryKey: [prefix, "agents", companyId] as const,
    queryFn: () => (client && companyId ? agentsApi.list(client, companyId) : Promise.resolve([])),
    enabled: !!client && !!companyId,
  });
  const projects = useQuery<Project[]>({
    queryKey: [prefix, "projects", companyId] as const,
    queryFn: () =>
      client && companyId ? projectsApi.list(client, companyId) : Promise.resolve([]),
    enabled: !!client && !!companyId,
    retry: false,
  });
  const goals = useQuery<Goal[]>({
    queryKey: [prefix, "goals", companyId] as const,
    queryFn: () =>
      client && companyId ? goalsApi.list(client, companyId) : Promise.resolve([]),
    enabled: !!client && !!companyId,
    retry: false,
  });

  // Default the assignee to the current agent on first load.
  useEffect(() => {
    if (!assigneeAgentId && instance?.identity?.id) {
      setAssigneeAgentId(instance.identity.id);
    }
  }, [assigneeAgentId, instance?.identity?.id]);

  const create = useMutation({
    mutationFn: async () => {
      if (!client || !companyId) throw new Error("No active connection");
      const body: CreateIssueInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assigneeAgentId: assigneeAgentId || null,
        parentId: parentId ?? null,
        projectId: projectId || null,
        goalId: goalId || null,
        inheritExecutionWorkspaceFromIssueId:
          inheritExecutionWorkspaceFromIssueId ?? undefined,
      };
      return issuesApi.create(client, companyId, body);
    },
    onSuccess: (issue) => {
      qc.invalidateQueries({ queryKey: [prefix, "inbox"] });
      qc.invalidateQueries({ queryKey: [prefix, "issues-search"] });
      if (parentId) {
        qc.invalidateQueries({ queryKey: [prefix, "issue", parentId] });
      }
      onCreated?.(issue.id);
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const body = err.body as { message?: string; error?: string } | undefined;
        setError(body?.message ?? body?.error ?? `${err.status}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to create issue");
      }
    },
  });

  if (!client || !companyId) {
    return (
      <ModalShell onClose={onClose}>
        <p className="text-sm text-muted">No active connection.</p>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose} title={parentId ? "Create subtask" : "Create issue"}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) {
            setError("Title is required");
            return;
          }
          setError(null);
          create.mutate();
        }}
      >
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Title</span>
          <Input
            required
            placeholder="What needs to happen?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-muted">Description</span>
          <textarea
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            rows={4}
            placeholder="Optional. Markdown is rendered server-side."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Priority</span>
            <select
              className="w-full rounded-md border border-border bg-surface px-2 py-2 text-sm"
              value={priority}
              onChange={(e) => setPriority(e.target.value as IssuePriority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Assignee</span>
            <select
              className="w-full rounded-md border border-border bg-surface px-2 py-2 text-sm"
              value={assigneeAgentId}
              onChange={(e) => setAssigneeAgentId(e.target.value)}
            >
              <option value="">— unassigned —</option>
              {agents.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.role ? ` · ${a.role}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1 text-sm">
            <span className="text-muted">
              Project {projects.error && <span className="text-xs">(unavailable)</span>}
            </span>
            <select
              className="w-full rounded-md border border-border bg-surface px-2 py-2 text-sm disabled:opacity-50"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={!!projects.error}
            >
              <option value="">— none —</option>
              {projects.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">
              Goal {goals.error && <span className="text-xs">(unavailable)</span>}
            </span>
            <select
              className="w-full rounded-md border border-border bg-surface px-2 py-2 text-sm disabled:opacity-50"
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              disabled={!!goals.error}
            >
              <option value="">— none —</option>
              {goals.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        {parentId && (
          <p className="text-xs text-muted">
            Creating as a subtask of <span className="font-mono">{parentId.slice(0, 8)}…</span>
            {inheritExecutionWorkspaceFromIssueId &&
              " (will inherit the parent's execution workspace)"}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending || !title.trim()}>
            {create.isPending ? "Creating…" : parentId ? "Create subtask" : "Create issue"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <Card className="w-full max-w-xl space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">{title ?? "Create issue"}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded p-1 text-muted hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </Card>
    </div>
  );
}
