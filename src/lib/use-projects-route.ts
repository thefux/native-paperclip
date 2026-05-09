import { useCallback, useEffect, useState } from "react";

/**
 * Sub-route state for the Projects tab (Phase E1 / [ROU-102](/ROU/issues/ROU-102)).
 *
 * URL contract:
 *   #projects                                 → list view (root)
 *   #projects/{projectId}                     → detail with default sub-tab (overview)
 *   #projects/{projectId}/{sub}               → detail on a specific sub-tab
 *
 * `sub` is one of `overview`, `issues`, `workspaces`, `configuration`,
 * `budget`. Unknown values fall back to `overview`. The hook keeps `sub` as a
 * free string and lets the consumer narrow to the union — same pattern as
 * `useCompaniesSubroute` so the routing convention is consistent across tabs.
 *
 * Drilldowns (list → detail, detail → list) push history entries so the OS
 * back gesture / browser back / Android hardware back pops one level. Sub-tab
 * switches use `replaceState` — we don't want back to walk through every pill
 * a user clicked.
 */
export type ProjectsSubroute =
  | { kind: "list" }
  | {
      kind: "detail";
      projectId: string;
      sub: string | null;
    };

export function useProjectsSubroute(): {
  route: ProjectsSubroute;
  enterDetail: (projectId: string, sub?: string) => void;
  setSub: (sub: string) => void;
  exitDetail: () => void;
} {
  const [route, setRoute] = useState<ProjectsSubroute>(() => ({ kind: "list" }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setRoute(parseHash(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const enterDetail = useCallback((projectId: string, sub?: string) => {
    const next: ProjectsSubroute = {
      kind: "detail",
      projectId,
      sub: sub ?? null,
    };
    setRoute(next);
    if (typeof window !== "undefined") {
      window.history.pushState({ __projects: Date.now() }, "", formatHash(next));
    }
  }, []);

  const setSub = useCallback((sub: string) => {
    setRoute((prev) => {
      if (prev.kind !== "detail") return prev;
      const next: ProjectsSubroute = { ...prev, sub };
      if (typeof window !== "undefined") {
        const hash = formatHash(next);
        if (window.location.hash !== hash) {
          window.history.replaceState(null, "", hash);
        }
      }
      return next;
    });
  }, []);

  const exitDetail = useCallback(() => {
    if (typeof window !== "undefined") {
      window.history.back();
      // hashchange fires from the back nav and the effect above syncs state.
      return;
    }
    setRoute({ kind: "list" });
  }, []);

  return { route, enterDetail, setSub, exitDetail };
}

function parseHash(rawHash: string): ProjectsSubroute {
  const raw = rawHash.replace(/^#/, "").trim();
  const segments = raw.split("/").filter((s) => s.length > 0);
  if (segments[0] !== "projects") return { kind: "list" };
  if (segments.length === 1) return { kind: "list" };
  return {
    kind: "detail",
    projectId: segments[1],
    sub: segments[2] ?? null,
  };
}

function formatHash(route: ProjectsSubroute): string {
  if (route.kind === "list") return "#projects";
  const parts = ["projects", route.projectId];
  if (route.sub) parts.push(route.sub);
  return `#${parts.join("/")}`;
}
