import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { issuesApi } from "@/lib/api/issues";
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

/**
 * Global search across the active company's issues. Debounces user input
 * for 200ms before issuing a request. Clicking a result opens it via
 * `onOpen`. Escape clears + closes the dropdown.
 */
export function SearchBar({ onOpen }: { onOpen: (issueId: string) => void }) {
  const { instance, client, prefix } = useActiveClient();
  const companyId = instance?.defaultCompanyId ?? instance?.identity?.companyId ?? "";
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 200);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const results = useQuery<InboxIssue[]>({
    queryKey: [prefix, "issues-search", debounced] as const,
    queryFn: async () => {
      if (!client || !companyId || !debounced) return [];
      return issuesApi.search(client, companyId, debounced, { limit: 20, includeTerminal: true });
    },
    enabled: !!client && !!companyId && debounced.length >= 2,
  });

  if (!client || !companyId) return null;

  return (
    <div ref={wrapRef} className="relative w-72">
      <div className="flex items-center gap-1.5 rounded-md border border-border bg-bg px-2 py-1 text-sm">
        <Search size={14} className="text-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
              inputRef.current?.blur();
            }
          }}
          placeholder="Search issues…"
          className="w-full bg-transparent placeholder:text-muted focus:outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="text-muted hover:text-fg"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {open && debounced.length >= 2 && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[28rem] overflow-hidden rounded-md border border-border bg-surface shadow-lg">
          {results.isLoading && (
            <div className="px-3 py-2 text-sm text-muted">Searching…</div>
          )}
          {results.isError && (
            <div className="px-3 py-2 text-sm text-red-400">
              {(results.error as Error).message}
            </div>
          )}
          {results.data && results.data.length === 0 && !results.isLoading && (
            <div className="px-3 py-2 text-sm text-muted">No matches.</div>
          )}
          <ul className="max-h-80 overflow-y-auto">
            {results.data?.map((issue) => (
              <li key={issue.id}>
                <button
                  onClick={() => {
                    onOpen(issue.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full flex-col items-start gap-1 border-b border-border/60 px-3 py-2 text-left text-sm hover:bg-border/40",
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
                  <span className="line-clamp-2">{issue.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
