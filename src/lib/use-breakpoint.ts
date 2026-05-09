import { useEffect, useState } from "react";

export type Breakpoint = "sm" | "md" | "lg";

/**
 * Mobile-shell convention for parity Phase A and beyond.
 *
 * **Use `bp !== "lg"` (i.e. `sm` AND `md`) when deciding whether to render the
 * mobile shell** — bottom-nav, single-pane drilldown, hide top-nav, full-width
 * lists. iPad portrait (768×1024) lands in `md` and is treated as mobile so the
 * workspace and every view stay aligned. Reserve `bp === "sm"` for phone-only
 * tweaks (tighter padding, smaller fonts) layered on top of the mobile shell.
 *
 * Rationale: we previously had `workspace.tsx` use `bp !== "lg"` and AuditView
 * use `bp === "sm"`, which broke at `md` (workspace renders mobile shell while
 * a view falls through to desktop two-pane). Consistent convention prevents
 * Phases B–G from re-introducing the same drift.
 *
 * Helpers below codify the rule so callers don't have to remember it.
 */
export function isMobileShell(bp: Breakpoint): boolean {
  return bp !== "lg";
}

export function isPhoneOnly(bp: Breakpoint): boolean {
  return bp === "sm";
}

/**
 * Returns the active breakpoint based on viewport width:
 *  - `sm` for `<641px` (phone)
 *  - `md` for `641-1023px` (tablet)
 *  - `lg` for `>=1024px` (desktop)
 *
 * On the server / first client render the value is `lg` so SSR markup matches
 * the desktop layout; the value updates after mount via matchMedia.
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>("lg");

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const sm = window.matchMedia("(max-width: 640px)");
    const md = window.matchMedia("(min-width: 641px) and (max-width: 1023px)");

    const update = () => {
      if (sm.matches) setBp("sm");
      else if (md.matches) setBp("md");
      else setBp("lg");
    };

    update();
    sm.addEventListener("change", update);
    md.addEventListener("change", update);
    return () => {
      sm.removeEventListener("change", update);
      md.removeEventListener("change", update);
    };
  }, []);

  return bp;
}
