import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Generic drill-down stack hook used by mobile push-navigation. Views render
 * the top of the stack; pushing replaces the visible pane, popping returns to
 * the previous one. Empty stack means "show the list / root view."
 *
 * Returns:
 *  - `stack`: ordered array, deepest item last. `top` is `stack[stack.length-1] ?? null`.
 *  - `push(item)`, `pop()`, `replace(item)`, `reset()` for stack mutations.
 *
 * On mobile the hook also wires `popstate` so the OS back gesture / hardware
 * back button pops one entry. Pushing logs a `history.pushState` so the next
 * back gesture can be intercepted; popping when the stack is empty is a no-op
 * (the parent screen handles the gesture).
 */
export function useDrilldown<T>(opts: { wireHistory?: boolean } = {}) {
  const { wireHistory = true } = opts;
  const [stack, setStack] = useState<T[]>([]);
  // We tag history entries we authored so popstate from elsewhere doesn't
  // accidentally pop our stack.
  const tokenRef = useRef(0);
  const internalPopRef = useRef(false);

  const push = useCallback(
    (item: T) => {
      setStack((s) => [...s, item]);
      if (wireHistory && typeof window !== "undefined") {
        tokenRef.current += 1;
        window.history.pushState({ __drilldown: tokenRef.current }, "");
      }
    },
    [wireHistory],
  );

  const pop = useCallback(() => {
    setStack((s) => (s.length === 0 ? s : s.slice(0, -1)));
    if (wireHistory && typeof window !== "undefined") {
      internalPopRef.current = true;
      window.history.back();
    }
  }, [wireHistory]);

  const replace = useCallback((item: T) => {
    setStack((s) => (s.length === 0 ? [item] : [...s.slice(0, -1), item]));
  }, []);

  const reset = useCallback(() => {
    setStack([]);
  }, []);

  useEffect(() => {
    if (!wireHistory || typeof window === "undefined") return;
    const onPop = () => {
      if (internalPopRef.current) {
        internalPopRef.current = false;
        return;
      }
      // OS back gesture: pop one entry off the visual stack if we have any.
      setStack((s) => (s.length === 0 ? s : s.slice(0, -1)));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [wireHistory]);

  return {
    stack,
    top: stack.length > 0 ? stack[stack.length - 1] : null,
    push,
    pop,
    replace,
    reset,
    isEmpty: stack.length === 0,
  };
}
