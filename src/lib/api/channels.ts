import type { ApiClient } from "@/lib/api/client";
import type { Channel, ChannelTypeDescriptor } from "@/lib/api/types";

/**
 * V2 channels API (ROU-53 Nostr + ROU-54 Telegram).
 *
 * The `/api/channels/*` and `/api/agents/:agentId/channels` routes return
 * `501 not_implemented` envelopes while ROU-53 / ROU-54 are still in
 * progress. Treat this module as the contract surface — the UI uses
 * `detectV2Stub` (see `./v2.ts`) to render a graceful banner until the
 * server-side phases ship.
 */
export const channels = {
  listTypes: (api: ApiClient) =>
    api.get<{ types: ChannelTypeDescriptor[]; phase?: number }>("/api/channels/types"),

  listForAgent: (api: ApiClient, agentId: string) =>
    api.get<{ channels: Channel[] } | Channel[]>(`/api/agents/${agentId}/channels`),

  addToAgent: (
    api: ApiClient,
    agentId: string,
    body: {
      type: string;
      label?: string;
      credential: Record<string, unknown> | string;
    },
  ) => api.post<Channel>(`/api/agents/${agentId}/channels`, body),

  update: (api: ApiClient, channelId: string, patch: Partial<Channel>) =>
    api.patch<Channel>(`/api/channels/${channelId}`, patch),

  remove: (api: ApiClient, channelId: string) => api.delete<void>(`/api/channels/${channelId}`),

  test: (api: ApiClient, channelId: string) =>
    api.post<{ ok: boolean; detail?: string }>(`/api/channels/${channelId}/test`),

  send: (
    api: ApiClient,
    channelId: string,
    body: { recipient: string; body: string },
  ) => api.post<{ delivered: boolean; messageId?: string }>(`/api/channels/${channelId}/send`, body),
};

/** Normalise the `listForAgent` response shape — server may return either form. */
export function unwrapChannels(payload: { channels: Channel[] } | Channel[]): Channel[] {
  return Array.isArray(payload) ? payload : payload.channels ?? [];
}
