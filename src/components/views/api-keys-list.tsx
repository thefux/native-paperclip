import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Copy,
  KeyRound,
  MoreHorizontal,
  Plus,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { useActiveClient } from "@/lib/store/use-active-client";
import {
  apiKeysApi,
  COMPANY_API_KEY_SCOPES,
  SCOPE_PRESETS,
  type CompanyApiKey,
  type CreatedApiKey,
  type ScopePreset,
} from "@/lib/api/api-keys";
import { isMobileShell, isPhoneOnly, useBreakpoint } from "@/lib/use-breakpoint";
import { Badge, Button, Card, Input } from "@/components/ui";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { Sheet } from "@/components/sheet";
import { ApiKeyAuditPanel } from "@/components/api-key-audit-panel";
import { cn, formatRelativeTime } from "@/lib/utils";

/**
 * API keys list page (Phase C1 / ROU-98 §C1.2). Lists every `pck_…` key for
 * the active company with create / revoke / per-key audit drilldowns.
 *
 * Routing — handled by the parent `<CompanySettingsView>` and
 * `useCompaniesSubroute`:
 *  - List view at `#companies/{cid}/settings/api-keys`
 *  - Detail at  `#companies/{cid}/settings/api-keys/{keyId}`
 *
 * Pre-FEATURE_V2 instances (where the route returns 404) render a graceful
 * "ask your admin to upgrade" empty state per the parity-plan constraints.
 */
export function ApiKeysList({
  companyId,
  selectedKeyId,
  onOpenKey,
  onCloseKey,
}: {
  companyId: string;
  selectedKeyId: string | null;
  onOpenKey: (keyId: string) => void;
  onCloseKey: () => void;
}) {
  const { client, instance, prefix } = useActiveClient();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<CompanyApiKey | null>(null);
  const bp = useBreakpoint();
  const isMobile = isMobileShell(bp);

  // The entire api-keys surface (LIST/POST/DELETE/rotate/audit-log) is
  // assertBoard-gated server-side per ROU-98 review §1, so a non-board key
  // hits 403 on every call. Detect that up-front so we don't waste a request
  // and so the user sees a recovery card instead of a generic 403 error.
  const nonBoardActor = !!instance && instance.actorType !== "board";

  const keysQuery = useQuery<CompanyApiKey[]>({
    queryKey: [prefix, "api-keys", companyId] as const,
    queryFn: () =>
      client && companyId ? apiKeysApi.list(client, companyId) : Promise.resolve([]),
    enabled: !!client && !!companyId && !nonBoardActor,
    retry: false,
  });

  // 404 here means the server is older than the per-company API-keys feature
  // (pre-ROU-42 / FEATURE_V2 disabled). Surface the same graceful empty state
  // the audit-log panel uses so the user can still see the rest of settings.
  const featureMissing =
    keysQuery.error instanceof ApiError && keysQuery.error.status === 404;
  // Defensive: the instance might mis-report actorType, or the server might
  // tighten the gate later. Render the same recovery card on a 403 even if we
  // didn't catch it via actorType up front.
  const boardRequired =
    nonBoardActor ||
    (keysQuery.error instanceof ApiError && keysQuery.error.status === 403);

  const selectedKey = selectedKeyId
    ? (keysQuery.data ?? []).find((k) => k.id === selectedKeyId)
    : null;

  const onRevoke = async (key: CompanyApiKey) => {
    if (!client) return;
    setPendingRevoke(null);
    const queryKey = [prefix, "api-keys", companyId] as const;
    const previous = queryClient.getQueryData<CompanyApiKey[]>(queryKey) ?? [];
    // Optimistically dim the row to "revoked".
    queryClient.setQueryData<CompanyApiKey[]>(queryKey, (curr) =>
      (curr ?? []).map((k) =>
        k.id === key.id ? { ...k, revokedAt: new Date().toISOString() } : k,
      ),
    );
    try {
      await apiKeysApi.revoke(client, companyId, key.id);
      // Refetch so we pick up the canonical revokedAt timestamp.
      void queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      // Roll back on error.
      queryClient.setQueryData<CompanyApiKey[]>(queryKey, previous);
      // Surface to the user — non-blocking toast would be ideal, but we don't
      // have one yet. Re-open the confirm sheet with an error message.
      const message =
        err instanceof ApiError ? `Server returned ${err.status}.` : (err as Error).message;
      setPendingRevoke({ ...key, label: `${key.label} — failed: ${message}` });
    }
  };

  if (selectedKey) {
    return (
      <ApiKeyDetail
        apiKey={selectedKey}
        isMobile={isMobile}
        onBack={onCloseKey}
        onRevoke={(k) => setPendingRevoke(k)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 px-4 pt-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <KeyRound size={16} aria-hidden /> API keys
          </h2>
          <p className="text-xs text-muted">
            <code className="font-mono">pck_…</code> tokens that can act on this
            company.
          </p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          aria-label="Create new API key"
          disabled={featureMissing || boardRequired}
        >
          <Plus size={14} className="mr-1" />
          New API key
        </Button>
      </header>

      <PullToRefresh
        onRefresh={async () => {
          await queryClient.invalidateQueries({
            queryKey: [prefix, "api-keys", companyId],
          });
        }}
        className="flex-1"
      >
        <div className="space-y-2 p-4">
          {keysQuery.isLoading && !boardRequired && (
            <p className="text-sm text-muted">Loading…</p>
          )}

          {boardRequired && <BoardRequiredCard actorType={instance?.actorType} />}

          {!boardRequired && featureMissing && (
            <Card className="border-yellow-500/40 bg-yellow-500/5 text-sm text-muted">
              Your Paperclip server is older than required for API key
              management — ask your admin to upgrade (V2 / FEATURE_V2 enabled).
              The audit-log panel may still work for keys created elsewhere.
            </Card>
          )}

          {!boardRequired && keysQuery.isError && !featureMissing && (
            <Card className="border-red-500/40 bg-red-500/5 text-sm text-red-300">
              Could not load API keys: {(keysQuery.error as Error).message}
            </Card>
          )}

          {!boardRequired &&
            !keysQuery.isLoading &&
            !keysQuery.isError &&
            keysQuery.data?.length === 0 && (
              <EmptyState onCreate={() => setCreating(true)} />
            )}

          {!boardRequired && keysQuery.data && keysQuery.data.length > 0 && (
            <ul className="space-y-2">
              {keysQuery.data.map((k) => (
                <ApiKeyRow
                  key={k.id}
                  apiKey={k}
                  isPhone={isPhoneOnly(bp)}
                  onOpen={() => onOpenKey(k.id)}
                  onRevokeRequest={() => setPendingRevoke(k)}
                />
              ))}
            </ul>
          )}
        </div>
      </PullToRefresh>

      <CreateApiKeySheet
        companyId={companyId}
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() =>
          queryClient.invalidateQueries({
            queryKey: [prefix, "api-keys", companyId],
          })
        }
      />

      <RevokeConfirmSheet
        target={pendingRevoke}
        onClose={() => setPendingRevoke(null)}
        onConfirm={(k) => onRevoke(k)}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="space-y-3 text-center">
      <KeyRound size={28} className="mx-auto text-muted" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-medium">No API keys yet.</p>
        <p className="text-xs text-muted">
          Create one to onboard another device or share access.
        </p>
      </div>
      <Button onClick={onCreate} className="mx-auto">
        <Plus size={14} className="mr-1" /> New API key
      </Button>
    </Card>
  );
}

function BoardRequiredCard({ actorType }: { actorType?: string | null }) {
  const actor =
    actorType === "company_api_key"
      ? "company API key"
      : actorType === "agent"
        ? "agent JWT"
        : actorType === "manual"
          ? "manual company id"
          : "current credential";
  return (
    <Card className="space-y-2 border-yellow-500/40 bg-yellow-500/5 text-sm">
      <div className="flex items-center gap-2 text-yellow-300">
        <ShieldOff size={16} aria-hidden />
        <span className="font-medium">Board credential required</span>
      </div>
      <p className="text-muted">
        API key management is gated to board users on this server. Your{" "}
        {actor} can&apos;t list or mint keys here. Switch to a board-user
        connection on this instance (or add one from the Companies tab) to
        manage keys.
      </p>
    </Card>
  );
}

function ApiKeyRow({
  apiKey,
  isPhone,
  onOpen,
  onRevokeRequest,
}: {
  apiKey: CompanyApiKey;
  isPhone: boolean;
  onOpen: () => void;
  onRevokeRequest: () => void;
}) {
  const revoked = !!apiKey.revokedAt;
  const swipeRef = useRef<HTMLLIElement>(null);
  const startXRef = useRef<number | null>(null);
  const swipeOffsetRef = useRef(0);
  const onRevokeRequestRef = useRef(onRevokeRequest);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  // Keep handler refs current so the listener (bound once) sees latest closures.
  useEffect(() => {
    onRevokeRequestRef.current = onRevokeRequest;
  }, [onRevokeRequest]);

  // Mobile swipe-left to reveal revoke action; release commits if past threshold.
  useEffect(() => {
    if (!isPhone) return;
    if (revoked) return; // No swipe affordance for already-revoked rows.
    const el = swipeRef.current;
    if (!el) return;

    const setOffset = (px: number) => {
      swipeOffsetRef.current = px;
      setSwipeOffset(px);
    };

    const onTouchStart = (e: TouchEvent) => {
      startXRef.current = e.touches[0].clientX;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startXRef.current === null) return;
      const dx = e.touches[0].clientX - startXRef.current;
      const constrained = Math.max(-120, Math.min(0, dx));
      setOffset(constrained);
    };
    const onTouchEnd = () => {
      const offset = swipeOffsetRef.current;
      startXRef.current = null;
      if (offset <= -80) {
        onRevokeRequestRef.current();
      }
      setOffset(0);
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
  }, [isPhone, revoked]);

  const trail = apiKey.prefix
    ? apiKey.prefix
    : apiKey.tokenLastEight
      ? `…${apiKey.tokenLastEight}`
      : "";

  return (
    <li ref={swipeRef} className="relative overflow-hidden rounded-md">
      {/* Swipe-revealed revoke action layer (mobile). */}
      {isPhone && !revoked && (
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 flex items-center bg-red-600/90 px-4 text-white"
          style={{ width: 120 }}
        >
          <Trash2 size={16} className="mr-2" />
          Revoke
        </div>
      )}

      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open audit log for ${apiKey.label}`}
        className={cn(
          "relative z-10 flex w-full items-center justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2.5 text-left transition-transform hover:bg-surface",
          revoked && "opacity-60",
        )}
        style={{ transform: `translateX(${swipeOffset}px)` }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {apiKey.label || "Untitled key"}
            </span>
            {revoked ? (
              <Badge tone="danger">Revoked</Badge>
            ) : (
              <Badge tone="success">Active</Badge>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            {trail && <span className="font-mono">{trail}</span>}
            {trail && <span aria-hidden>·</span>}
            <span>created {formatRelativeTime(apiKey.createdAt)}</span>
            {apiKey.lastUsedAt && (
              <>
                <span aria-hidden>·</span>
                <span>used {formatRelativeTime(apiKey.lastUsedAt)}</span>
              </>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {apiKey.scopes.map((s) => (
              <Badge key={s} tone="neutral">
                {s}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 text-muted">
          {!isPhone && !revoked && (
            <span
              role="button"
              tabIndex={0}
              aria-label={`More actions for ${apiKey.label}`}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setMenuOpen((o) => !o);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  setMenuOpen((o) => !o);
                }
              }}
              className="rounded p-1 text-muted hover:bg-bg hover:text-fg"
            >
              <MoreHorizontal size={16} />
            </span>
          )}
          <ChevronRight size={16} aria-hidden />
        </div>
      </button>

      {/* Desktop overflow menu: positioned over the row. */}
      {menuOpen && !isPhone && !revoked && (
        <div
          className="absolute right-2 top-10 z-20 rounded-md border border-border bg-surface shadow-lg"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(false);
              onRevokeRequest();
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-300 hover:bg-bg"
          >
            <Trash2 size={14} /> Revoke key
          </button>
        </div>
      )}
    </li>
  );
}

function ApiKeyDetail({
  apiKey,
  isMobile,
  onBack,
  onRevoke,
}: {
  apiKey: CompanyApiKey;
  isMobile: boolean;
  onBack: () => void;
  onRevoke: (k: CompanyApiKey) => void;
}) {
  // `<ApiKeyAuditPanel>` reads the active company id from `useActiveClient`
  // itself; we just pass the keyId so it skips the picker.
  const revoked = !!apiKey.revokedAt;
  const trail = apiKey.prefix
    ? apiKey.prefix
    : apiKey.tokenLastEight
      ? `…${apiKey.tokenLastEight}`
      : "";

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <header className="flex items-center gap-3">
        <Button variant="ghost" onClick={onBack} aria-label="Back to API keys">
          ← Back
        </Button>
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">
            {apiKey.label || "Untitled key"}
          </h2>
          <p className="text-xs text-muted">
            {trail && <span className="font-mono">{trail} · </span>}
            created {formatRelativeTime(apiKey.createdAt)}
            {apiKey.lastUsedAt && <> · used {formatRelativeTime(apiKey.lastUsedAt)}</>}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {revoked ? (
            <Badge tone="danger">Revoked</Badge>
          ) : (
            <>
              <Badge tone="success">Active</Badge>
              {!isMobile && (
                <Button variant="danger" onClick={() => onRevoke(apiKey)}>
                  <Trash2 size={14} className="mr-1" /> Revoke key
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      <Card className="space-y-2">
        <span className="text-xs uppercase tracking-wide text-muted">Scopes</span>
        <div className="flex flex-wrap gap-1">
          {apiKey.scopes.map((s) => (
            <Badge key={s} tone="neutral">
              {s}
            </Badge>
          ))}
        </div>
      </Card>

      <ApiKeyAuditPanel keyId={apiKey.id} />

      {isMobile && !revoked && (
        <Button variant="danger" onClick={() => onRevoke(apiKey)} className="w-full">
          <Trash2 size={14} className="mr-1" /> Revoke key
        </Button>
      )}
    </div>
  );
}

/**
 * The V2 server returns structured 400 bodies for validation failures, e.g.
 * `{ error: "invalid_scopes", details: { invalid: [...], supported: [...] } }`.
 * We pull `details.supported` out so the form stays useful even if the client's
 * scope list ever falls behind the server's.
 */
function formatBadRequestError(err: ApiError): string {
  const body = err.body;
  if (body && typeof body === "object") {
    const e = (body as { error?: unknown }).error;
    const details = (body as { details?: unknown }).details;
    if (e === "invalid_scopes" && details && typeof details === "object") {
      const supported = (details as { supported?: unknown }).supported;
      if (Array.isArray(supported) && supported.length > 0) {
        return `Server rejected the chosen scopes. Supported on this instance: ${supported.join(
          ", ",
        )}.`;
      }
    }
    if (typeof e === "string" && e.length > 0) {
      return `Server rejected the request: ${e}.`;
    }
  }
  return "Server rejected the request — likely the chosen scopes aren't supported on this instance.";
}

function CreateApiKeySheet({
  companyId,
  open,
  onClose,
  onCreated,
}: {
  companyId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { client, instance } = useActiveClient();
  const [label, setLabel] = useState("");
  const [presetId, setPresetId] = useState<ScopePreset["id"]>("per-company");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);

  // Only board-user keys can mint a wildcard key — gate the "Full access"
  // preset behind that check.
  const canFullAccess = instance?.actorType === "board";
  const visiblePresets = SCOPE_PRESETS.filter(
    (p) => p.id !== "full" || canFullAccess,
  );
  const activePreset =
    visiblePresets.find((p) => p.id === presetId) ?? visiblePresets[0];

  const mutation = useMutation({
    mutationFn: async ({ label, scopes }: { label: string; scopes: string[] }) => {
      if (!client) throw new Error("No active client");
      return apiKeysApi.create(client, companyId, { label, scopes });
    },
    onSuccess: (data) => {
      setCreated(data);
      onCreated();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setError(formatBadRequestError(err));
        } else if (err.status === 403) {
          setError(
            "This API key isn't allowed to mint another key. Use a board-user key.",
          );
        } else {
          setError(`Server returned ${err.status}.`);
        }
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to create key.");
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!label.trim()) {
      setError("Name is required.");
      return;
    }
    if (!activePreset) {
      setError("Pick a scope preset.");
      return;
    }
    // Validate the preset's scopes are server-recognised — this is belt-and-
    // braces; the constants come from the same source of truth.
    const invalid = activePreset.scopes.filter(
      (s) => !COMPANY_API_KEY_SCOPES.includes(s),
    );
    if (invalid.length > 0) {
      setError(`Unknown scope(s): ${invalid.join(", ")}.`);
      return;
    }
    mutation.mutate({ label: label.trim(), scopes: [...activePreset.scopes] });
  };

  const handleClose = () => {
    if (mutation.isPending) return; // Don't close mid-flight.
    setLabel("");
    setPresetId("per-company");
    setError(null);
    setCreated(null);
    mutation.reset();
    onClose();
  };

  return (
    <Sheet open={open} onClose={handleClose} title={created ? "API key created" : "New API key"}>
      {created ? (
        <CopyOnceReveal
          token={created.token}
          apiKey={created.key}
          onDone={handleClose}
        />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Name</span>
            <Input
              required
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='e.g. "MacBook Pro – tthe"'
              aria-label="API key name"
              disabled={mutation.isPending}
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm text-muted">Scope</legend>
            <ul className="space-y-1.5">
              {visiblePresets.map((p) => (
                <li key={p.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border border-border bg-bg p-3",
                      presetId === p.id && "border-accent/60 bg-accent/10",
                    )}
                  >
                    <input
                      type="radio"
                      name="scope-preset"
                      checked={presetId === p.id}
                      onChange={() => setPresetId(p.id)}
                      disabled={mutation.isPending}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{p.label}</div>
                      <div className="text-xs text-muted">{p.blastRadius}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.scopes.map((s) => (
                          <Badge key={s} tone="neutral">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
            {!canFullAccess && (
              <p className="text-[11px] text-muted">
                Full-access scope is only mintable from a board-user key.
              </p>
            )}
          </fieldset>

          {error && (
            <p className="flex items-start gap-2 text-sm text-red-300" role="alert">
              <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={handleClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create key"}
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}

const REVEAL_TIMEOUT_MS = 60_000;

function CopyOnceReveal({
  token,
  apiKey,
  onDone,
}: {
  token: string;
  apiKey: CompanyApiKey;
  onDone: () => void;
}) {
  const [revealed, setRevealed] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const tokenRef = useRef<HTMLSpanElement>(null);

  // Auto-hide the secret after 60 seconds even if the user hasn't copied it.
  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => setRevealed(false), REVEAL_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [revealed]);

  const onCopy = async () => {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      // Give the live region a beat to announce, then hide the secret.
      window.setTimeout(() => setRevealed(false), 800);
    } catch {
      // Tauri permission edge case (or http-context). Don't auto-hide; let the
      // user select-and-copy manually instead.
      setCopyFailed(true);
    }
  };

  // When the manual fallback is in play, clicking the secret span selects all
  // of it so the user can ⌘C / Ctrl+C in one move.
  const onSelectSecret = () => {
    const node = tokenRef.current;
    if (!node) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm">
        <strong>{apiKey.label || "Untitled key"}</strong> is ready. Copy the secret
        below — <em>you can&apos;t view it again</em>. Generate a new one if you
        need to copy it later.
      </p>

      <div
        className="rounded-md border border-border bg-bg p-3 font-mono text-xs"
        onClick={revealed && copyFailed ? onSelectSecret : undefined}
        role={revealed && copyFailed ? "button" : undefined}
        tabIndex={revealed && copyFailed ? 0 : undefined}
        onKeyDown={
          revealed && copyFailed
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectSecret();
                }
              }
            : undefined
        }
      >
        {revealed ? (
          <span
            ref={tokenRef}
            aria-label="Full API key — copy now"
            className="break-all"
          >
            {token}
          </span>
        ) : (
          <span className="text-muted">
            {apiKey.prefix ?? "pck_"}
            <span aria-hidden>……………………………</span>{" "}
            <span className="not-italic text-yellow-300">(hidden)</span>
          </span>
        )}
      </div>

      {revealed && copyFailed && (
        <p className="text-xs text-yellow-300">
          Copy failed (clipboard not available). Tap the secret above to select
          it, then copy with ⌘C / Ctrl+C.
        </p>
      )}

      {/* Polite live region so screen readers announce the copy. */}
      <div role="status" aria-live="polite" className="sr-only">
        {copied ? "API key copied to clipboard" : ""}
      </div>

      <div className="flex gap-2">
        {revealed ? (
          <>
            <Button onClick={onCopy} className="flex-1">
              {copied ? (
                <>
                  <Check size={14} className="mr-1" /> Copied
                </>
              ) : (
                <>
                  <Copy size={14} className="mr-1" /> Copy secret
                </>
              )}
            </Button>
            {copyFailed && (
              <Button variant="ghost" onClick={() => setRevealed(false)}>
                I copied manually
              </Button>
            )}
          </>
        ) : (
          <Button onClick={onDone} className="flex-1">
            Done
          </Button>
        )}
      </div>

      {!revealed && (
        <p className="text-xs text-muted">
          The secret is no longer viewable. If you didn&apos;t capture it, revoke
          this key and create a new one.
        </p>
      )}
    </div>
  );
}

function RevokeConfirmSheet({
  target,
  onClose,
  onConfirm,
}: {
  target: CompanyApiKey | null;
  onClose: () => void;
  onConfirm: (k: CompanyApiKey) => void;
}) {
  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      title="Revoke API key"
    >
      {target && (
        <div className="space-y-4">
          <p className="text-sm">
            Revoke <strong>{target.label || "Untitled key"}</strong>? Anyone using
            this key will lose access immediately. This can&apos;t be undone.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => onConfirm(target)}
            >
              Revoke key
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
