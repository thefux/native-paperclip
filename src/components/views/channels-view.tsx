import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { ApiError } from "@/lib/api/client";
import { channels, unwrapChannels } from "@/lib/api/channels";
import { detectV2Stub } from "@/lib/api/v2";
import { Badge, Button, Card, Input } from "@/components/ui";
import { formatRelativeTime } from "@/lib/utils";
import type { Channel, ChannelTypeDescriptor } from "@/lib/api/types";
import { Send, TestTube2, Trash2 } from "lucide-react";

interface AgentSummary {
  id: string;
  name: string;
  role?: string;
  title?: string | null;
}

const CREDENTIAL_HINT: Record<string, string> = {
  nostr: '{"nsec":"nsec1…","relays":["wss://relay.damus.io"]}',
  telegram: '{"botToken":"123:ABC…","chatId":"-100…"}',
};

export function ChannelsView() {
  const { instance: active, client, prefix } = useActiveClient();
  const companyId = active?.identity?.companyId ?? active?.defaultCompanyId ?? "";
  const [agentId, setAgentId] = useState<string>(active?.identity?.id ?? "");

  const agents = useQuery<AgentSummary[]>({
    queryKey: [prefix, "agents", companyId] as const,
    queryFn: async () =>
      client && companyId ? client.get<AgentSummary[]>(`/api/companies/${companyId}/agents`) : [],
    enabled: !!client && !!companyId,
  });

  if (!client || !companyId) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-muted">Channels</span>
        <select
          className="rounded border border-border bg-bg px-2 py-1 text-sm"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
        >
          <option value="">— pick agent —</option>
          {agents.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {!agentId && (
          <p className="text-sm text-muted">Pick an agent above to manage their channels.</p>
        )}
        {agentId && <ChannelsForAgent agentId={agentId} />}
      </div>
    </div>
  );
}

function ChannelsForAgent({ agentId }: { agentId: string }) {
  const { client, prefix } = useActiveClient();
  const qc = useQueryClient();

  const types = useQuery<{ types: ChannelTypeDescriptor[]; phase?: number }>({
    queryKey: [prefix, "channel-types"] as const,
    queryFn: async () => (client ? channels.listTypes(client) : { types: [] }),
    enabled: !!client,
    retry: false,
  });

  const list = useQuery<Channel[]>({
    queryKey: [prefix, "channels", agentId] as const,
    queryFn: async () => (client ? unwrapChannels(await channels.listForAgent(client, agentId)) : []),
    enabled: !!client && !!agentId,
    retry: false,
  });

  const stub = detectV2Stub(list.error) ?? detectV2Stub(types.error);

  const removeChannel = useMutation({
    mutationFn: async (channelId: string) => {
      if (!client) throw new Error("No client");
      return channels.remove(client, channelId);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [prefix, "channels", agentId] }),
  });

  return (
    <div className="space-y-4">
      {stub && <PhaseStubBanner stub={stub} />}

      {!stub && list.isLoading && <p className="text-sm text-muted">Loading channels…</p>}

      {!stub && list.data && list.data.length === 0 && (
        <Card>
          <p className="text-sm text-muted">No channels configured for this agent yet.</p>
        </Card>
      )}

      {!stub && list.data?.map((channel) => (
        <ChannelCard
          key={channel.id}
          channel={channel}
          onDelete={() => removeChannel.mutate(channel.id)}
        />
      ))}

      <AddChannelForm
        agentId={agentId}
        types={types.data?.types ?? []}
        disabled={!!stub}
      />
    </div>
  );
}

function PhaseStubBanner({
  stub,
}: {
  stub: NonNullable<ReturnType<typeof detectV2Stub>>;
}) {
  const phaseTicket = stub.feature?.startsWith("v2.channels")
    ? "ROU-53 (Nostr) / ROU-54 (Telegram)"
    : "the relevant phase ticket";
  return (
    <Card className="border-yellow-500/40 bg-yellow-500/5">
      <div className="flex items-start gap-2">
        <Badge tone="warn">Phase {stub.phase ?? "?"}</Badge>
        <div className="text-sm">
          <p className="font-medium">Channels API not shipped on this instance.</p>
          <p className="mt-1 text-muted">{stub.message}</p>
          <p className="mt-2 text-xs text-muted">
            This screen will light up automatically once {phaseTicket} lands and the instance is
            redeployed.
          </p>
        </div>
      </div>
    </Card>
  );
}

function ChannelCard({ channel, onDelete }: { channel: Channel; onDelete: () => void }) {
  const { instance: active, client, prefix } = useActiveClient();
  const [recipient, setRecipient] = useState("");
  const [body, setBody] = useState("");
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<string | null>(null);

  const test = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("No client");
      return channels.test(client, channel.id);
    },
    onSuccess: (r) => setTestStatus(r.ok ? "ok" : (r.detail ?? "failed")),
    onError: (err) => setTestStatus(err instanceof Error ? err.message : "error"),
  });

  const send = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("No client");
      return channels.send(client, channel.id, { recipient, body });
    },
    onSuccess: (r) => {
      setSendStatus(r.delivered ? `delivered (${r.messageId ?? "ok"})` : "queued");
      setBody("");
    },
    onError: (err) =>
      setSendStatus(err instanceof Error ? err.message : "error"),
  });

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge tone="info">{channel.type}</Badge>
        <span className="text-sm font-medium">{channel.label ?? "(unlabelled)"}</span>
        <Badge tone={channel.enabled ? "success" : "neutral"}>
          {channel.enabled ? "enabled" : "disabled"}
        </Badge>
        <span className="ml-auto text-xs text-muted">
          updated {formatRelativeTime(channel.updatedAt)}
        </span>
        <Button
          variant="danger"
          className="px-2 py-1 text-xs"
          aria-label="Delete channel"
          onClick={onDelete}
        >
          <Trash2 size={12} />
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Button variant="ghost" onClick={() => test.mutate()} disabled={test.isPending}>
          <TestTube2 size={12} className="mr-1" />
          {test.isPending ? "Testing…" : "Test"}
        </Button>
        {testStatus && <span className="text-muted">test: {testStatus}</span>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!recipient.trim() || !body.trim()) return;
          send.mutate();
        }}
        className="space-y-2 border-t border-border pt-2"
      >
        <p className="text-xs uppercase tracking-wide text-muted">Send DM</p>
        <Input
          placeholder="recipient (npub… / chat id / @handle)"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
        <textarea
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          rows={3}
          placeholder="message body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex items-center gap-2 text-xs">
          <Button type="submit" disabled={send.isPending || !recipient.trim() || !body.trim()}>
            <Send size={12} className="mr-1" />
            {send.isPending ? "Sending…" : "Send"}
          </Button>
          {sendStatus && <span className="text-muted">{sendStatus}</span>}
        </div>
      </form>
    </Card>
  );
}

function AddChannelForm({
  agentId,
  types,
  disabled,
}: {
  agentId: string;
  types: ChannelTypeDescriptor[];
  disabled: boolean;
}) {
  const { client, prefix } = useActiveClient();
  const qc = useQueryClient();
  const [type, setType] = useState<string>(types[0]?.type ?? "nostr");
  const [label, setLabel] = useState("");
  const [credential, setCredential] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("No client");
      let credentialPayload: Record<string, unknown> | string = credential;
      try {
        credentialPayload = JSON.parse(credential);
      } catch {
        // accept raw string credential, server can also reject
      }
      return channels.addToAgent(client, agentId, {
        type,
        label: label || undefined,
        credential: credentialPayload,
      });
    },
    onSuccess: () => {
      setLabel("");
      setCredential("");
      setError(null);
      qc.invalidateQueries({ queryKey: [prefix, "channels", agentId] });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const body = err.body as { message?: string } | undefined;
        setError(body?.message ?? `${err.status}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to add channel");
      }
    },
  });

  return (
    <Card className="space-y-2">
      <header className="text-sm font-medium">Add channel</header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!credential.trim()) return;
          create.mutate();
        }}
        className="space-y-2 text-sm"
      >
        <div className="flex items-center gap-2">
          <select
            disabled={disabled}
            className="rounded border border-border bg-bg px-2 py-1"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {(types.length ? types : [{ type: "nostr", label: "Nostr" }, { type: "telegram", label: "Telegram" }]).map(
              (t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ),
            )}
          </select>
          <Input
            placeholder="label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={disabled}
          />
        </div>
        <textarea
          disabled={disabled}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-mono"
          rows={4}
          placeholder={CREDENTIAL_HINT[type] ?? "credential JSON or raw string"}
          value={credential}
          onChange={(e) => setCredential(e.target.value)}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <Button
          type="submit"
          disabled={disabled || create.isPending || !credential.trim()}
        >
          {create.isPending ? "Saving…" : "Save channel"}
        </Button>
      </form>
    </Card>
  );
}
