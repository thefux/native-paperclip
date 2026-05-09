import { useEffect, useState } from "react";
import { VALID_TAB_IDS, type Tab } from "@/components/shell/tabs";

/**
 * Two-way bind a workspace tab to `location.hash` (e.g. `#dashboard`).
 *
 * The hash format is `#<tab>(/<subpath>)?` — only the first slash-separated
 * segment is matched against the workspace tab list. Anything after that is
 * sub-route state owned by the active tab (Phase C1: Companies → Settings →
 * API Keys lives at `#companies/{cid}/settings/{section}`). Tabs that need
 * sub-routes parse the suffix themselves; bare tabs ignore it.
 *
 * - On mount the hook seeds state from the current hash so deep-links and
 *   Tauri's restored-window state place the user back where they were.
 * - User-initiated tab changes call `setTab` which updates the hash without
 *   pushing a new history entry (the back gesture should drill within a tab,
 *   not bounce between tabs). When `setTab` is called, any existing sub-route
 *   suffix is dropped — switching to a different tab resets that tab's
 *   internal navigation state.
 * - `popstate` / `hashchange` events sync state back when the user uses the
 *   browser's back/forward.
 */
export function useTabHash(defaultTab: Tab): [Tab, (tab: Tab) => void] {
  const [tab, setTabState] = useState<Tab>(defaultTab);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initial = readTabFromHash();
    if (initial) setTabState(initial);

    const onHashChange = () => {
      const next = readTabFromHash();
      if (next) setTabState(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const setTab = (next: Tab) => {
    setTabState(next);
    if (typeof window !== "undefined") {
      const target = `#${next}`;
      if (window.location.hash !== target) {
        // replaceState avoids polluting history; tab switches are not "back" steps.
        window.history.replaceState(null, "", target);
      }
    }
  };

  return [tab, setTab];
}

function readTabFromHash(): Tab | null {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) return null;
  const first = raw.split("/")[0];
  return VALID_TAB_IDS.has(first as Tab) ? (first as Tab) : null;
}
