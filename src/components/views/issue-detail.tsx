
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { agentsApi } from "@/lib/api/agents";
import { issuesApi } from "@/lib/api/issues";
import { Badge, Button, Card, Input } from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils";
import { IssueCreateForm } from "@/components/issue-create-form";
import { IssueDocuments } from "@/components/views/issue-documents";
import type { AgentSummary, Comment, Issue, IssueStatus } from "@/lib/api/types";

const STATUSES: IssueStatus[] = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
];

export function IssueDetail({
  issueId,
  onOpen,
  onBack,
}: {
  issueId: string;
  /** Open another issue (for blocker / child / search-result navigation). Optional. */
  onOpen?: (id: string) => void;
  /** Mobile drilldown: render a back button that pops the detail and returns to the list. */
  onBack?: () => void;
}) {
  const { instance, client, prefix } = useActiveClient();
  const qc = useQueryClient();
  const companyId = instance?.defaultCompanyId ?? instance?.identity?.companyId ?? "";

  const issue = useQuery<Issue | null>({
    queryKey: [prefix, "issue", issueId] as const,
    queryFn: async () => (client ? issuesApi.get(client, issueId) : null),
    enabled: !!client,
  });
  const comments = useQuery<Comment[]>({
    queryKey: [prefix, "comments", issueId] as const,
    queryFn: async () =>
      client ? client.get<Comment[]>(`/api/issues/${issueId}/comments`) : [],
    enabled: !!client,
  });
  const agents = useQuery<AgentSummary[]>({
    queryKey: [prefix, "agents", companyId] as const,
    queryFn: () =>
      client && companyId ? agentsApi.list(client, companyId) : Promise.resolve([]),
    enabled: !!client && !!companyId,
  });

  const patchIssue = useMutation({
    mutationFn: async (body: Parameters<typeof issuesApi.patch>[2]) => {
      if (!client) throw new Error("No active instance");
      return issuesApi.patch(client, issueId, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [prefix, "issue", issueId] });
      qc.invalidateQueries({ queryKey: [prefix, "inbox"] });
      qc.invalidateQueries({ queryKey: [prefix, "inbox-filtered"] });
    },
  });
  const postComment = useMutation({
    mutationFn: async (body: { body: string }) => {
      if (!client) throw new Error("No active instance");
      return client.post<Comment>(`/api/issues/${issueId}/comments`, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [prefix, "comments", issueId] }),
  });

  const [newComment, setNewComment] = useState("");
  const [creatingSubtask, setCreatingSubtask] = useState(false);
  const [editingBlockers, setEditingBlockers] = useState(false);
  const [blockerDraft, setBlockerDraft] = useState("");

  if (!client) return null;
  if (issue.isLoading) return <div className="p-4 text-muted">Loading…</div>;
  if (!issue.data) return <div className="p-4 text-muted">Not found.</div>;

  const i = issue.data;
  const myAgentId = instance?.identity?.id ?? "";

  return (
    <div className="flex h-full flex-col">
      <header className="space-y-2 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to inbox"
              className="-ml-1 rounded p-1 text-muted hover:bg-surface hover:text-fg"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <span className="font-mono text-muted">{i.identifier}</span>
          <Badge tone="info">{i.status}</Badge>
          <Badge tone="warn">{i.priority}</Badge>
          <span className="ml-auto text-muted">Updated {formatRelativeTime(i.updatedAt)}</span>
        </div>
        <h2 className="text-lg font-semibold">{i.title}</h2>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <label className="flex items-center gap-1">
            <span>Assignee:</span>
            <select
              className="rounded border border-border bg-bg px-1.5 py-0.5"
              value={i.assigneeAgentId ?? ""}
              onChange={(e) =>
                patchIssue.mutate({
                  assigneeAgentId: e.target.value || null,
                  comment: e.target.value
                    ? `Reassigned via Paperclip Native`
                    : `Unassigned via Paperclip Native`,
                })
              }
              disabled={patchIssue.isPending}
            >
              <option value="">— unassigned —</option>
              {agents.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.id === myAgentId ? " (me)" : ""}
                  {a.role ? ` · ${a.role}` : ""}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="ghost"
            className="ml-auto px-2 py-0.5 text-xs"
            onClick={() => setCreatingSubtask(true)}
          >
            <Plus size={12} className="mr-1" />
            Subtask
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {i.description && (
          <article className="whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-sm">
            {i.description}
          </article>
        )}

        <BlockerPanel
          issue={i}
          editing={editingBlockers}
          onEditToggle={() => {
            setEditingBlockers((v) => !v);
            setBlockerDraft((i.blockedBy ?? []).map((b) => b.identifier).join(", "));
          }}
          draft={blockerDraft}
          onDraftChange={setBlockerDraft}
          onSubmit={() => {
            const ids = parseBlockerInput(blockerDraft);
            patchIssue.mutate(
              { blockedByIssueIds: ids, comment: ids.length ? `Blockers updated` : `Blockers cleared` },
              {
                onSuccess: () => {
                  setEditingBlockers(false);
                },
              },
            );
          }}
          onOpen={onOpen}
          onCancel={() => setEditingBlockers(false)}
        />

        {(i.children?.length ?? 0) > 0 && (
          <Card className="space-y-1.5">
            <span className="text-xs uppercase tracking-wide text-muted">Subtasks</span>
            <ul className="space-y-1">
              {i.children!.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-muted">{c.identifier}</span>
                  <Badge tone="neutral">{c.status}</Badge>
                  <button
                    className="truncate text-left hover:underline"
                    onClick={() => onOpen?.(c.id)}
                  >
                    {c.title}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <IssueDocuments issueId={issueId} />

        <section>
          <h3 className="mb-2 text-xs uppercase tracking-wide text-muted">Comments</h3>
          <ul className="space-y-2">
            {comments.data?.map((c) => (
              <li key={c.id} className="rounded-md border border-border bg-surface p-3 text-sm">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted">
                  <span>{c.authorAgentId ?? c.authorUserId ?? "system"}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(c.createdAt)}</span>
                </div>
                <div className="whitespace-pre-wrap">{c.body}</div>
              </li>
            ))}
            {comments.data?.length === 0 && (
              <li className="text-sm text-muted">No comments yet.</li>
            )}
          </ul>
        </section>
      </div>

      <footer className="space-y-2 border-t border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Status:</span>
          {STATUSES.map((s) => (
            <button
              key={s}
              disabled={patchIssue.isPending || s === i.status}
              onClick={() =>
                patchIssue.mutate({ status: s, comment: `Status → ${s} via Paperclip Native` })
              }
              className="rounded border border-border px-1.5 py-0.5 hover:bg-bg disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newComment.trim()) return;
            postComment.mutate(
              { body: newComment },
              { onSuccess: () => setNewComment("") },
            );
          }}
          className="flex gap-2"
        >
          <Input
            placeholder="Add a comment…"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <Button type="submit" disabled={postComment.isPending || !newComment.trim()}>
            {postComment.isPending ? "Posting…" : "Post"}
          </Button>
        </form>
      </footer>

      {creatingSubtask && (
        <IssueCreateForm
          parentId={issueId}
          inheritExecutionWorkspaceFromIssueId={issueId}
          onClose={() => setCreatingSubtask(false)}
          onCreated={(id) => {
            onOpen?.(id);
          }}
        />
      )}
    </div>
  );
}

function BlockerPanel({
  issue,
  editing,
  draft,
  onEditToggle,
  onDraftChange,
  onSubmit,
  onCancel,
  onOpen,
}: {
  issue: Issue;
  editing: boolean;
  draft: string;
  onEditToggle: () => void;
  onDraftChange: (s: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onOpen?: (id: string) => void;
}) {
  const blockers = issue.blockedBy ?? [];
  const blocks = issue.blocks ?? [];
  return (
    <Card className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted">Blockers</span>
        <Button variant="ghost" className="ml-auto px-2 py-0.5 text-xs" onClick={onEditToggle}>
          {editing ? "Cancel" : "Edit"}
        </Button>
      </div>

      {!editing && blockers.length === 0 && (
        <p className="text-xs text-muted">None — this issue is unblocked.</p>
      )}

      {!editing &&
        blockers.map((b) => (
          <div key={b.id} className="flex items-center gap-2 text-sm">
            <span className="font-mono text-xs text-muted">{b.identifier}</span>
            <Badge tone="neutral">{b.status}</Badge>
            <button
              className="truncate text-left hover:underline"
              onClick={() => onOpen?.(b.id)}
            >
              {b.title}
            </button>
          </div>
        ))}

      {editing && (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            Comma-separated issue ids or identifiers (e.g. <code>ROU-79, 4ebcc204-…</code>).
            Leave blank to clear.
          </p>
          <Input
            placeholder=""
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCancel} className="text-xs">
              Cancel
            </Button>
            <Button onClick={onSubmit} className="text-xs">
              Save blockers
            </Button>
          </div>
          <p className="text-[11px] text-muted">
            Note: identifiers like <code>ROU-79</code> only work if the server resolves them; if the
            update returns a 400 use raw uuids.
          </p>
        </div>
      )}

      {blocks.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">Blocks {blocks.length}</summary>
          <ul className="mt-1 space-y-1 pl-2">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center gap-2">
                <span className="font-mono">{b.identifier}</span>
                <Badge tone="neutral">{b.status}</Badge>
                <button className="truncate hover:underline" onClick={() => onOpen?.(b.id)}>
                  {b.title}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function parseBlockerInput(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
