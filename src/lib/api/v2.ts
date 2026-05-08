import { ApiError } from "@/lib/api/client";
import type { V2Stub } from "@/lib/api/types";

/**
 * Recognise the structured `not_implemented` envelope that V2 stub routes
 * return. Phase 2 (Nostr — ROU-53) and Phase 3 (Telegram — ROU-54) channel
 * routes return this shape until those tasks ship; the UI uses it to render
 * a "shipping in Phase X" banner instead of a raw 5xx.
 */
export interface PendingV2Surface {
  feature?: string;
  phase?: number;
  message: string;
}

export function detectV2Stub(err: unknown): PendingV2Surface | null {
  if (!(err instanceof ApiError)) return null;
  if (err.status !== 501) return null;
  const body = err.body as Partial<V2Stub> | undefined;
  if (!body || typeof body !== "object") {
    return { message: "Endpoint is not implemented yet on this Paperclip instance." };
  }
  if (body.error !== "not_implemented") return null;
  return {
    feature: body.feature,
    phase: typeof body.phase === "number" ? body.phase : undefined,
    message:
      typeof body.message === "string"
        ? body.message
        : "This V2 surface is not implemented yet on this Paperclip instance.",
  };
}
