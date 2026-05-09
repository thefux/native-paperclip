
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { Badge, Button, Input } from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils";
import type { Comment, Issue, IssueStatus } from "@/lib/api/types";

const STATUSES: IssueStatus[] = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
];

export function IssueDetail({ issueId }: { issueId: string }) {
  const { client, prefix } = useActiveClient();
  const qc = useQueryClient();

  const issue = useQuery<Issue | null>({
    queryKey: [prefix, "issue", issueId] as const,
    queryFn: async () => (client ? client.get<Issue>(`/api/issues/${issueId}`) : null),
    enabled: !!client,
  });
  const comments = useQuery<Comment[]>({
    queryKey: [prefix, "comments", issueId] as const,
    queryFn: async () =>
      client ? client.get<Comment[]>(`/api/issues/${issueId}/comments`) : [],
    enabled: !!client,
  });

  const patchIssue = useMutation({
    mutationFn: async (body: { status?: IssueStatus; comment?: string }) => {
      if (!client) throw new Error("No active instance");
      return client.patch<Issue>(`/api/issues/${issueId}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [prefix, "issue", issueId] });
      qc.invalidateQueries({ queryKey: [prefix, "inbox"] });
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

  if (!client) return null;
  if (issue.isLoading) return <div className="p-4 text-muted">Loading…</div>;
  if (!issue.data) return <div className="p-4 text-muted">Not found.</div>;

  const i = issue.data;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-muted">{i.identifier}</span>
          <Badge tone="info">{i.status}</Badge>
          <Badge tone="warn">{i.priority}</Badge>
          <span className="ml-auto text-muted">Updated {formatRelativeTime(i.updatedAt)}</span>
        </div>
        <h2 className="mt-1 text-lg font-semibold">{i.title}</h2>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {i.description && (
          <article className="mb-4 whitespace-pre-wrap rounded-md border border-border bg-surface p-3 text-sm">
            {i.description}
          </article>
        )}

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
    </div>
  );
}
