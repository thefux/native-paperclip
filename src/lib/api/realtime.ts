import type { Instance } from "@/lib/store/instances";
import { trimTrailingSlash } from "@/lib/utils";
import type { PaperclipEvent } from "@/lib/api/types";

// Subscribe to the instance's company-scoped event stream.
// Returns an unsubscribe fn that closes the socket.
export function subscribeEvents(
  instance: Pick<Instance, "baseUrl" | "apiKey">,
  companyId: string,
  onEvent: (event: PaperclipEvent) => void,
  onStatus?: (status: "open" | "closed" | "error") => void,
): () => void {
  const httpBase = trimTrailingSlash(instance.baseUrl);
  const wsBase = httpBase.replace(/^http/, "ws");
  const url = `${wsBase}/api/companies/${companyId}/events/ws?token=${encodeURIComponent(
    instance.apiKey,
  )}`;

  let ws: WebSocket | null = null;
  let closedByCaller = false;
  let backoff = 500;

  const connect = () => {
    ws = new WebSocket(url);
    ws.addEventListener("open", () => {
      backoff = 500;
      onStatus?.("open");
    });
    ws.addEventListener("message", (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as PaperclipEvent;
        onEvent(parsed);
      } catch {
        // ignore malformed frames
      }
    });
    ws.addEventListener("error", () => onStatus?.("error"));
    ws.addEventListener("close", () => {
      onStatus?.("closed");
      if (closedByCaller) return;
      const delay = Math.min(backoff, 15_000);
      backoff = Math.min(backoff * 2, 15_000);
      setTimeout(connect, delay);
    });
  };

  connect();

  return () => {
    closedByCaller = true;
    ws?.close();
  };
}
