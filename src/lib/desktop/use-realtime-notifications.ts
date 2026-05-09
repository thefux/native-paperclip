import { useEffect, useRef } from "react";
import { useInstanceStore } from "@/lib/store/instances";
import { subscribeEvents } from "@/lib/api/realtime";
import { ensurePermission, notify } from "@/lib/desktop/notifications";
import type { PaperclipEvent } from "@/lib/api/types";

/**
 * Subscribes to the active instance's company-scoped event stream and
 * fires OS-level notifications for high-signal events:
 *
 * - `issue.commented` on issues assigned to me → "New comment on ROU-X"
 * - `approval.created` → "Approval needs your attention"
 * - `routine.failed` → "Routine X failed"
 *
 * Honors the active connection's id so a switch tears down the prior
 * subscription cleanly. The callback `onOpenIssue` lets the chrome wire
 * notification clicks back to the inbox detail pane.
 */
export function useRealtimeNotifications(
  onOpenIssue: (issueId: string) => void,
): void {
  const active = useInstanceStore((s) => s.active());
  const onOpenRef = useRef(onOpenIssue);
  onOpenRef.current = onOpenIssue;

  useEffect(() => {
    if (!active) return;
    const myAgentId = active.identity?.id;
    const companyId = active.defaultCompanyId ?? active.identity?.companyId;
    if (!companyId) return;

    let cancelled = false;
    void ensurePermission().catch(() => {
      /* Some browsers throw if the user has blocked notifications globally — ignore. */
    });

    const unsubscribe = subscribeEvents(active, companyId, (event: PaperclipEvent) => {
      if (cancelled) return;
      handleEvent(event, myAgentId, (issueId) => onOpenRef.current(issueId));
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [active?.id, active?.baseUrl, active?.apiKey, active?.defaultCompanyId, active?.identity?.id, active]);
}

function handleEvent(
  event: PaperclipEvent,
  myAgentId: string | undefined,
  onOpenIssue: (issueId: string) => void,
) {
  if (!event || typeof event !== "object" || !event.type) return;
  const payload = (event.payload ?? {}) as Record<string, unknown>;

  if (event.type === "issue.commented" || event.type === "comment.created") {
    const issueId = stringField(payload, "issueId");
    const identifier = stringField(payload, "issueIdentifier") ?? stringField(payload, "identifier");
    const author = stringField(payload, "authorAgentName") ?? stringField(payload, "authorName");
    const assignee = stringField(payload, "assigneeAgentId");
    if (!issueId) return;
    if (myAgentId && assignee && assignee !== myAgentId) return;
    void notify(`New comment on ${identifier ?? "an issue"}`, {
      body: author ? `From ${author}` : undefined,
      tag: `issue-comment:${issueId}`,
      onClick: () => onOpenIssue(issueId),
    });
    return;
  }

  if (event.type === "approval.created" || event.type === "approval.requested") {
    const title = stringField(payload, "title") ?? "Approval needs your attention";
    void notify("Approval requested", {
      body: title,
      tag: `approval:${stringField(payload, "id") ?? Math.random()}`,
    });
    return;
  }

  if (event.type === "routine.failed" || event.type === "run.failed") {
    const name = stringField(payload, "routineName") ?? stringField(payload, "name") ?? "A routine";
    void notify(`${name} failed`, {
      body: stringField(payload, "errorMessage") ?? undefined,
      tag: `routine-failed:${stringField(payload, "id") ?? Math.random()}`,
    });
    return;
  }
}

function stringField(o: Record<string, unknown>, key: string): string | undefined {
  const v = o[key];
  return typeof v === "string" ? v : undefined;
}
