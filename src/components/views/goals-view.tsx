import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { goalsApi } from "@/lib/api/agents";
import { issuesApi } from "@/lib/api/issues";
import { Badge, Button, Card, Input } from "@/components/ui";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Goal, InboxIssue, IssueStatus } from "@/lib/api/types";

const STATUS_TONE: Record<IssueStatus, "neutral" | "info" | "warn" | "danger" | "success"> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "info",
  in_review: "warn",
  blocked: "danger",
  done: "success",
  cancelled: "neutral",
};

export function GoalsView({ onOpenIssue }: { onOpenIssue: (id: string) => void }) {
  const { instance, client, prefix, companyId } = useActiveClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const goals = useQuery<Goal[]>({
    queryKey: [prefix, "goals", companyId] as const,
    queryFn: () =>
      client && companyId ? goalsApi.list(client, companyId) : Promise.resolve([]),
    enabled: !!client && !!companyId,
    retry: false,
  });

  if (!client) return null;
  if (!companyId) return <div className="p-3 text-sm text-muted">No company selected.</div>;

  return (
    <div className="flex h-full">
      <aside className="w-72 shrink-0 border-r border-border">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="text-xs uppercase tracking-wide text-muted">Goals</span>
          <Button
            variant="ghost"
            className="ml-auto px-2 py-0.5 text-xs"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={12} className="mr-1" />
            New
          </Button>
        </div>

        <ul className="overflow-y-auto">
          {goals.isLoading && <li className="p-3 text-sm text-muted">Loading…</li>}
          {goals.isError && (
            <li className="p-3 text-sm text-yellow-300">
              Goals unavailable: {(goals.error as Error).message}
            </li>
          )}
          {goals.data?.length === 0 && (
            <li className="p-3 text-sm text-muted">No goals yet.</li>
          )}
          {goals.data?.map((g) => (
            <li key={g.id}>
              <button
                onClick={() => setSelectedId(g.id)}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 border-b border-border/60 px-3 py-2 text-left hover:bg-surface",
                  selectedId === g.id && "bg-surface",
                )}
              >
                <span className="text-sm font-medium">{g.title}</span>
                {g.status && <span className="text-xs text-muted">{g.status}</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex-1 overflow-y-auto">
        {selectedId ? (
          <GoalDetail
            goal={goals.data?.find((g) => g.id === selectedId) ?? null}
            onOpenIssue={onOpenIssue}
          />
        ) : (
          <div className="grid h-full place-items-center text-muted">
            <p className="text-sm">Select a goal</p>
          </div>
        )}
      </section>

      {showCreate && (
        <CreateGoalModal
          companyId={companyId}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}

function GoalDetail({
  goal,
  onOpenIssue,
}: {
  goal: Goal | null;
  onOpenIssue: (id: string) => void;
}) {
  const { instance, client, prefix, companyId } = useActiveClient();

  const issues = useQuery<InboxIssue[]>({
    queryKey: [prefix, "goal-issues", goal?.id] as const,
    queryFn: async () => {
      if (!client || !companyId || !goal) return [];
      return issuesApi.list(client, companyId, {
        goalId: goal.id,
        includeTerminal: true,
        limit: 100,
      });
    },
    enabled: !!client && !!companyId && !!goal,
  });

  if (!goal) return null;

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">{goal.title}</h2>
        {goal.description && (
          <p className="text-sm text-muted">{goal.description}</p>
        )}
        {goal.status && <Badge tone="info">{goal.status}</Badge>}
      </header>

      <section className="space-y-2">
        <h3 className="text-xs uppercase tracking-wide text-muted">
          Issues toward this goal ({issues.data?.length ?? 0})
        </h3>
        {issues.isLoading && <p className="text-sm text-muted">Loading…</p>}
        {issues.data?.length === 0 && (
          <Card>
            <p className="text-sm text-muted">No issues linked to this goal yet.</p>
          </Card>
        )}
        <ul className="divide-y divide-border/40 rounded-md border border-border bg-surface text-sm">
          {issues.data?.map((issue) => (
            <li key={issue.id}>
              <button
                onClick={() => onOpenIssue(issue.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-border/30"
              >
                <span className="font-mono text-xs text-muted">{issue.identifier}</span>
                <Badge tone={STATUS_TONE[issue.status]}>{issue.status}</Badge>
                <span className="truncate">{issue.title}</span>
                <span className="ml-auto text-xs text-muted">
                  {formatRelativeTime(issue.updatedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CreateGoalModal({
  companyId,
  onClose,
  onCreated,
}: {
  companyId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { client, prefix } = useActiveClient();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("No active connection");
      return goalsApi.create(client, companyId, {
        title: title.trim(),
        description: description.trim() || undefined,
      });
    },
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: [prefix, "goals", companyId] });
      onCreated(g.id);
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6 backdrop-blur-sm">
      <Card className="w-full max-w-md space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">New goal</h2>
          <Button variant="ghost" className="ml-auto text-xs" onClick={onClose}>
            Cancel
          </Button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) {
              setError("Title is required");
              return;
            }
            setError(null);
            create.mutate();
          }}
          className="space-y-3"
        >
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Title</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Description</span>
            <textarea
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending || !title.trim()}>
              {create.isPending ? "Creating…" : "Create goal"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
