import { useEffect, useState } from "react";
import { VALID_TAB_IDS, type Tab } from "@/components/shell/tabs";

/**
 * Two-way bind a workspace tab to `location.hash` (e.g. `#dashboard`).
 *
 * - On mount the hook seeds state from the current hash so deep-links and
 *   Tauri's restored-window state place the user back where they were.
 * - User-initiated tab changes call `setTab` which updates the hash without
 *   pushing a new history entry (the back gesture should drill within a tab,
 *   not bounce between tabs).
 * - `popstate` / `hashchange` events sync state back when the user uses the
 *   browser's back/forward.
 */
export function useTabHash(defaultTab: Tab): [Tab, (tab: Tab) => void] {
  const [tab, setTabState] = useState<Tab>(defaultTab);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const readHash = (): Tab | null => {
      const raw = window.location.hash.replace(/^#/, "").trim();
      if (!raw) return null;
      return VALID_TAB_IDS.has(raw as Tab) ? (raw as Tab) : null;
    };

    const initial = readHash();
    if (initial) setTabState(initial);

    const onHashChange = () => {
      const next = readHash();
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
