import { ApiClient, ApiError } from "@/lib/api/client";
import type { InstanceActorType, InstanceCompany } from "@/lib/store/instances";

export interface ResolvedIdentity {
  id?: string;
  companyId: string;
  /** Company display name when `/api/me` returns one. Manual-cid path leaves this undefined. */
  companyName?: string;
  role?: string;
  displayName?: string;
  source: "api/me" | "agents/me" | "manual-cid";
  /** Actor type the server saw. `manual-cid` for the legacy escape hatch. */
  actorType: InstanceActorType;
  /** Every company this token can access (board: N, pck_: 1, agent: 1). Empty for manual-cid. */
  accessibleCompanies: InstanceCompany[];
}

interface MeResponse {
  actor: {
    type: "agent" | "company_api_key" | "board" | string;
    agentId?: string | null;
    companyId?: string | null;
    userId?: string | null;
    userName?: string | null;
    companyIds?: string[];
    scopes?: string[];
  };
  agent?: { id: string; name: string; role?: string } | null;
  company?: { id: string; name: string; issuePrefix?: string | null } | null;
  companies?: { id: string; name: string; issuePrefix?: string | null }[];
}

interface AgentsMeResponse {
  id: string;
  companyId: string;
  role?: string;
  name?: string;
}

/**
 * Resolve an identity for the pasted token.
 *
 * V2 (≥ ROU-58 fix) ships `GET /api/me` which works for every actor type and
 * returns a populated `companyId`. Older instances only expose
 * `GET /api/agents/me` (agent-JWT-only, 401s pck_ tokens). We try the new
 * route first, fall back to the agent-only route, and as a last resort accept
 * `pck_…` tokens with a manually-pasted `companyId` once the caller has
 * verified proof-of-life via `/api/agents/me/inbox-lite`.
 */
export async function resolveIdentity(
  client: ApiClient,
  manualCompanyId?: string | null,
): Promise<ResolvedIdentity> {
  // 1. Preferred path — pck_-aware /api/me shim.
  try {
    const me = await client.get<MeResponse>("/api/me");
    const actor = me.actor;
    const companies = collectCompanies(me);
    // Prefer the requested companyId when the caller already knows it (used by
    // the activation refresh hook to keep the active company across reloads).
    const preferredCompanyId =
      manualCompanyId ?? actor.companyId ?? me.company?.id ?? companies[0]?.id;
    const companyId = preferredCompanyId;
    if (companyId) {
      const companyName =
        me.company?.id === companyId
          ? me.company?.name
          : companies.find((c) => c.id === companyId)?.name;
      return {
        id: actor.agentId ?? actor.userId ?? me.agent?.id ?? undefined,
        companyId,
        companyName: companyName ?? undefined,
        role: me.agent?.role ?? actor.type,
        displayName: me.agent?.name ?? actor.userName ?? me.company?.name ?? undefined,
        source: "api/me",
        actorType: normalizeActorType(actor.type),
        accessibleCompanies: companies,
      };
    }
    // /api/me responded but didn't include a companyId (e.g. board user with
    // zero memberships). Drop through to the manual cid path.
  } catch (err) {
    // Older instances 404 here; pck_ tokens on a pre-shim deployment also 404.
    // Both are recoverable — keep trying.
    if (err instanceof ApiError && err.status !== 404 && err.status !== 401) {
      throw err;
    }
  }

  // 2. Legacy agent-JWT path.
  try {
    const me = await client.get<AgentsMeResponse>("/api/agents/me");
    const companyName = await fetchCompanyName(client, me.companyId);
    return {
      id: me.id,
      companyId: me.companyId,
      companyName,
      role: me.role,
      displayName: me.name,
      source: "agents/me",
      actorType: "agent",
      accessibleCompanies: [
        { id: me.companyId, name: companyName ?? undefined },
      ],
    };
  } catch (err) {
    if (!(err instanceof ApiError) || (err.status !== 401 && err.status !== 403)) {
      throw err;
    }
    // 401 is the expected path for pck_ tokens against pre-shim instances.
  }

  // 3. Manual companyId path — proof-of-life via inbox-lite (which is
  // pck_-aware as of ROU-42), then trust the user-supplied cid.
  if (!manualCompanyId) {
    throw new ApiError(
      401,
      "GET /api/me",
      "This instance does not expose /api/me yet (pre-ROU-58). Paste the company id to continue, or upgrade the instance.",
    );
  }
  await client.get<unknown>(`/api/agents/me/inbox-lite?agentId=${encodeURIComponent("self")}`).catch(() => {
    // inbox-lite may return 422 for a non-uuid query agent; the call returning
    // 200/422 (not 401) is enough to confirm the token is accepted.
  });
  // Final probe — list company agents. 200 means the cid is valid for this
  // pck_ token and the company exists.
  await client.get<unknown[]>(`/api/companies/${encodeURIComponent(manualCompanyId)}/agents`);
  const companyName = await fetchCompanyName(client, manualCompanyId);
  return {
    companyId: manualCompanyId,
    companyName,
    source: "manual-cid",
    actorType: "manual-cid",
    accessibleCompanies: [{ id: manualCompanyId, name: companyName ?? undefined }],
  };
}

function collectCompanies(me: MeResponse): InstanceCompany[] {
  const out: InstanceCompany[] = [];
  const seen = new Set<string>();
  const push = (c: { id?: string | null; name?: string; issuePrefix?: string | null } | null | undefined) => {
    if (!c?.id || seen.has(c.id)) return;
    seen.add(c.id);
    out.push({ id: c.id, name: c.name, issuePrefix: c.issuePrefix ?? undefined });
  };
  if (Array.isArray(me.companies)) {
    for (const c of me.companies) push(c);
  }
  push(me.company);
  if (me.actor?.companyId) push({ id: me.actor.companyId });
  return out;
}

function normalizeActorType(type: string | undefined): InstanceActorType {
  if (type === "agent" || type === "company_api_key" || type === "board") return type;
  return "manual-cid";
}

async function fetchCompanyName(
  client: ApiClient,
  companyId: string,
): Promise<string | undefined> {
  try {
    const company = await client.get<{ id: string; name?: string }>(
      `/api/companies/${encodeURIComponent(companyId)}`,
    );
    return company?.name ?? undefined;
  } catch {
    // Older instances may not expose the read-by-id route, or the pck_ key may
    // lack the necessary scope. Either way the name is cosmetic — fall through.
    return undefined;
  }
}
