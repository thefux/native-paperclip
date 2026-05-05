
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useInstanceStore } from "@/lib/store/instances";
import { createClient } from "@/lib/api/client";
import { Badge } from "@/components/ui";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { InboxIssue, IssuePriority, IssueStatus } from "@/lib/api/types";

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

export function InboxView({
  onOpen,
  openId,
}: {
  onOpen: (id: string) => void;
  openId: string | null;
}) {
  const active = useInstanceStore((s) => s.active());
  const client = useMemo(() => (active ? createClient(active) : null), [active]);

  const inbox = useQuery<InboxIssue[]>({
    queryKey: ["inbox", client?.baseUrl ?? "none"] as const,
    queryFn: async () => {
      if (!client) return [];
      return client.get<InboxIssue[]>("/api/agents/me/inbox-lite");
    },
    enabled: !!client,
  });

  if (!client) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2 text-xs uppercase tracking-wide text-muted">
        Inbox
      </div>
      <ul className="flex-1 overflow-y-auto">
        {inbox.isLoading && <li className="p-3 text-sm text-muted">Loading…</li>}
        {inbox.isError && (
          <li className="p-3 text-sm text-red-400">{(inbox.error as Error).message}</li>
        )}
        {inbox.data?.length === 0 && (
          <li className="p-3 text-sm text-muted">Inbox is empty.</li>
        )}
        {inbox.data?.map((issue) => (
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
    </div>
  );
}
