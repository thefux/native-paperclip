import { useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const PULL_THRESHOLD = 64;
const MAX_PULL = 120;

/**
 * Touch-driven pull-to-refresh wrapper for list views. Only engages when the
 * scroll container is at the top and the user drags down. On release past the
 * threshold it calls `onRefresh()` and shows a spinner until the promise
 * resolves.
 *
 * The wrapper is a no-op on devices with a fine pointer (mouse/desktop) — those
 * users have a dedicated refresh affordance elsewhere and shouldn't see the
 * pull animation.
 *
 * Listeners are bound exactly once on mount; pull/refresh state lives in refs
 * so a fast drag doesn't re-bind handlers on every touchmove. The visual layer
 * still re-renders via `setPullPx` / `setRefreshing`, but the touch contract
 * stays attached to the element.
 */
export function PullToRefresh({
  onRefresh,
  children,
  className,
}: {
  onRefresh: () => Promise<unknown> | unknown;
  children: ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const pullPxRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Keep the ref current so the listener (bound once on mount) always calls
  // the latest `onRefresh` without re-binding.
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Skip on fine-pointer devices.
    if (window.matchMedia && !window.matchMedia("(pointer: coarse)").matches) {
      return;
    }

    const setPull = (px: number) => {
      pullPxRef.current = px;
      setPullPx(px);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (el.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      // Resistance curve so the pull feels heavier the further you go.
      const resisted = Math.min(MAX_PULL, dy * 0.5);
      setPull(resisted);
    };

    const onTouchEnd = async () => {
      const distance = pullPxRef.current;
      startYRef.current = null;
      if (distance >= PULL_THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPull(PULL_THRESHOLD);
        try {
          await onRefreshRef.current();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const armed = pullPx >= PULL_THRESHOLD;

  return (
    <div ref={containerRef} className={cn("relative h-full overflow-y-auto", className)}>
      {(pullPx > 0 || refreshing) && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center text-muted"
          style={{ height: pullPx, transform: `translateY(-${Math.max(0, PULL_THRESHOLD - pullPx)}px)` }}
        >
          <RefreshCw
            size={18}
            className={cn(
              "transition-transform",
              refreshing ? "animate-spin text-accent-strong" : armed ? "text-accent-strong" : "",
            )}
            style={{ transform: refreshing ? undefined : `rotate(${pullPx * 3}deg)` }}
          />
        </div>
      )}
      <div style={{ transform: `translateY(${pullPx}px)`, transition: pullPx === 0 ? "transform 200ms" : "none" }}>
        {children}
      </div>
    </div>
  );
}
