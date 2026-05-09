import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Sub-route state for the Agents tab (Phase D1 / [ROU-101](/ROU/issues/ROU-101)).
 *
 * URL contract:
 *   #agents                                   → list view (root)
 *   #agents?status=active                     → list with filter chip applied
 *   #agents/{agentId}                         → detail (default tab: overview)
 *   #agents/{agentId}/{section}               → detail sub-tab (overview|runs|skills|budget)
 *   #agents/{agentId}/runs/{runId}            → run transcript drilldown
 *
 * The list `?status=` filter is intentionally a query string on the bare hash:
 *   `#agents?status=active`
 * That keeps Phase B's `?status=` URL contract for filter chips while leaving
 * `/{agentId}/...` as the path drilldown. We parse both shapes here.
 *
 * Drilldowns push history entries so OS back gestures / browser back pop one
 * level. Hash changes from elsewhere stay in sync via `hashchange`.
 */
export type AgentsSubroute =
  | { kind: "list"; statusFilter: AgentStatusFilter }
  | {
      kind: "detail";
      agentId: string;
      section: AgentDetailSection;
      runId: string | null;
    };

export type AgentStatusFilter = "all" | "active" | "paused" | "error";

export type AgentDetailSection = "overview" | "runs" | "skills" | "budget";

const VALID_FILTERS: ReadonlySet<AgentStatusFilter> = new Set([
  "all",
  "active",
  "paused",
  "error",
]);

const VALID_SECTIONS: ReadonlySet<AgentDetailSection> = new Set([
  "overview",
  "runs",
  "skills",
  "budget",
]);

const DEFAULT_FILTER: AgentStatusFilter = "all";
const DEFAULT_SECTION: AgentDetailSection = "overview";

export function useAgentsSubroute(): {
  route: AgentsSubroute;
  setStatusFilter: (filter: AgentStatusFilter) => void;
  enterDetail: (agentId: string, section?: AgentDetailSection) => void;
  setSection: (section: AgentDetailSection) => void;
  enterRun: (runId: string) => void;
  exitRun: () => void;
  exitDetail: () => void;
} {
  const [route, setRoute] = useState<AgentsSubroute>(() => ({
    kind: "list",
    statusFilter: DEFAULT_FILTER,
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setRoute(parseHash(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const setStatusFilter = useCallback((filter: AgentStatusFilter) => {
    setRoute((prev) => {
      if (prev.kind !== "list") return prev;
      const next: AgentsSubroute = { kind: "list", statusFilter: filter };
      if (typeof window !== "undefined") {
        const hash = formatHash(next);
        if (window.location.hash !== hash) {
          // replaceState — flicking between filter chips shouldn't pollute history.
          window.history.replaceState(null, "", hash);
        }
      }
      return next;
    });
  }, []);

  const enterDetail = useCallback(
    (agentId: string, section: AgentDetailSection = DEFAULT_SECTION) => {
      const next: AgentsSubroute = {
        kind: "detail",
        agentId,
        section,
        runId: null,
      };
      setRoute(next);
      if (typeof window !== "undefined") {
        window.history.pushState({ __agents: Date.now() }, "", formatHash(next));
      }
    },
    [],
  );

  const setSection = useCallback((section: AgentDetailSection) => {
    setRoute((prev) => {
      if (prev.kind !== "detail") return prev;
      const next: AgentsSubroute = { ...prev, section, runId: null };
      if (typeof window !== "undefined") {
        const hash = formatHash(next);
        if (window.location.hash !== hash) {
          window.history.replaceState(null, "", hash);
        }
      }
      return next;
    });
  }, []);

  const enterRun = useCallback((runId: string) => {
    setRoute((prev) => {
      if (prev.kind !== "detail") return prev;
      const next: AgentsSubroute = { ...prev, runId };
      if (typeof window !== "undefined") {
        window.history.pushState({ __agents: Date.now() }, "", formatHash(next));
      }
      return next;
    });
  }, []);

  const exitRun = useCallback(() => {
    if (typeof window !== "undefined") {
      window.history.back();
      return;
    }
    setRoute((prev) => (prev.kind === "detail" ? { ...prev, runId: null } : prev));
  }, []);

  const exitDetail = useCallback(() => {
    if (typeof window !== "undefined") {
      window.history.back();
      return;
    }
    setRoute({ kind: "list", statusFilter: DEFAULT_FILTER });
  }, []);

  return useMemo(
    () => ({
      route,
      setStatusFilter,
      enterDetail,
      setSection,
      enterRun,
      exitRun,
      exitDetail,
    }),
    [route, setStatusFilter, enterDetail, setSection, enterRun, exitRun, exitDetail],
  );
}

function parseHash(rawHash: string): AgentsSubroute {
  const raw = rawHash.replace(/^#/, "");
  // Split off query string first; it only matters for the list view.
  const [pathPart, queryPart = ""] = raw.split("?", 2);
  const segments = pathPart.split("/").filter((s) => s.length > 0);
  if (segments[0] !== "agents") {
    return { kind: "list", statusFilter: DEFAULT_FILTER };
  }
  if (segments.length === 1) {
    const params = new URLSearchParams(queryPart);
    const candidate = params.get("status");
    const filter: AgentStatusFilter =
      candidate && VALID_FILTERS.has(candidate as AgentStatusFilter)
        ? (candidate as AgentStatusFilter)
        : DEFAULT_FILTER;
    return { kind: "list", statusFilter: filter };
  }
  const agentId = segments[1];
  const sectionRaw = segments[2];
  const section: AgentDetailSection =
    sectionRaw && VALID_SECTIONS.has(sectionRaw as AgentDetailSection)
      ? (sectionRaw as AgentDetailSection)
      : DEFAULT_SECTION;
  // `#agents/{id}/runs/{runId}` only makes sense when section === "runs". On
  // any other section the trailing segment is ignored.
  let runId: string | null = null;
  if (section === "runs" && segments[3]) {
    runId = segments[3];
  }
  return { kind: "detail", agentId, section, runId };
}

function formatHash(route: AgentsSubroute): string {
  if (route.kind === "list") {
    if (route.statusFilter === DEFAULT_FILTER) return "#agents";
    return `#agents?status=${route.statusFilter}`;
  }
  const parts = ["agents", route.agentId];
  if (route.section !== DEFAULT_SECTION || route.runId) parts.push(route.section);
  if (route.runId) parts.push(route.runId);
  return `#${parts.join("/")}`;
}
