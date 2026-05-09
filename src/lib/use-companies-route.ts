import { useCallback, useEffect, useState } from "react";

/**
 * Sub-route state for the Companies tab.
 *
 * URL contract (Phase C1 / ROU-98):
 *   #companies                                     → list view (root)
 *   #companies/{companyId}/settings                → settings shell (default section)
 *   #companies/{companyId}/settings/{section}      → settings sub-tab
 *   #companies/{companyId}/settings/{section}/{keyId} → drilldown (api-keys only)
 *
 * Drilldowns push history entries so the OS back gesture (Android hardware
 * back, iOS swipe-back, browser back button) pops one level. The hook listens
 * to `hashchange` to keep state in sync. `section` is a free string (validated
 * by the consumer); the hook is tab-agnostic so the routing convention can
 * extend without re-touching this file.
 */
export type CompaniesSubroute =
  | { kind: "list" }
  | {
      kind: "settings";
      companyId: string;
      section: string | null;
      keyId: string | null;
    };

export function useCompaniesSubroute(): {
  route: CompaniesSubroute;
  enterSettings: (companyId: string, section?: string) => void;
  setSection: (section: string) => void;
  enterKey: (keyId: string) => void;
  exitKey: () => void;
  exitSettings: () => void;
} {
  const [route, setRoute] = useState<CompaniesSubroute>(() => ({ kind: "list" }));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setRoute(parseHash(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const enterSettings = useCallback((companyId: string, section?: string) => {
    const next: CompaniesSubroute = {
      kind: "settings",
      companyId,
      section: section ?? null,
      keyId: null,
    };
    setRoute(next);
    if (typeof window !== "undefined") {
      window.history.pushState({ __companies: Date.now() }, "", formatHash(next));
    }
  }, []);

  const setSection = useCallback((section: string) => {
    setRoute((prev) => {
      if (prev.kind !== "settings") return prev;
      const next: CompaniesSubroute = { ...prev, section, keyId: null };
      if (typeof window !== "undefined") {
        const hash = formatHash(next);
        if (window.location.hash !== hash) {
          // Sub-tab pill switches replace, not push — we don't want OS back to
          // walk through every section the user clicked.
          window.history.replaceState(null, "", hash);
        }
      }
      return next;
    });
  }, []);

  const enterKey = useCallback((keyId: string) => {
    setRoute((prev) => {
      if (prev.kind !== "settings") return prev;
      const next: CompaniesSubroute = { ...prev, keyId };
      if (typeof window !== "undefined") {
        window.history.pushState({ __companies: Date.now() }, "", formatHash(next));
      }
      return next;
    });
  }, []);

  const exitKey = useCallback(() => {
    if (typeof window !== "undefined") {
      window.history.back();
      // hashchange fires from the back nav and the effect above syncs state.
      return;
    }
    setRoute((prev) => (prev.kind === "settings" ? { ...prev, keyId: null } : prev));
  }, []);

  const exitSettings = useCallback(() => {
    if (typeof window !== "undefined") {
      window.history.back();
      return;
    }
    setRoute({ kind: "list" });
  }, []);

  return { route, enterSettings, setSection, enterKey, exitKey, exitSettings };
}

function parseHash(rawHash: string): CompaniesSubroute {
  const raw = rawHash.replace(/^#/, "").trim();
  const segments = raw.split("/").filter((s) => s.length > 0);
  if (segments[0] !== "companies") return { kind: "list" };
  if (segments.length === 1) return { kind: "list" };
  const companyId = segments[1];
  if (segments[2] !== "settings") return { kind: "list" };
  return {
    kind: "settings",
    companyId,
    section: segments[3] ?? null,
    keyId: segments[4] ?? null,
  };
}

function formatHash(route: CompaniesSubroute): string {
  if (route.kind === "list") return "#companies";
  const parts = ["companies", route.companyId, "settings"];
  if (route.section) parts.push(route.section);
  if (route.keyId) {
    if (!route.section) parts.push("api-keys");
    parts.push(route.keyId);
  }
  return `#${parts.join("/")}`;
}
