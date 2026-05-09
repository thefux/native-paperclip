import { trimTrailingSlash } from "@/lib/utils";
import type { Instance } from "@/lib/store/instances";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiClient = ReturnType<typeof createClient>;

export interface CreateClientOptions {
  /** Fires when any request returns 401/403. The chrome uses this to flag the connection degraded so a re-auth banner can render. */
  onUnauthorized?: (status: number) => void;
}

export function createClient(
  instance: Pick<Instance, "baseUrl" | "apiKey">,
  options: CreateClientOptions = {},
) {
  const base = trimTrailingSlash(instance.baseUrl);

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${instance.apiKey}`,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "omit",
    });

    if (!res.ok) {
      let errBody: unknown = undefined;
      try {
        errBody = await res.json();
      } catch {
        errBody = await res.text().catch(() => undefined);
      }
      if ((res.status === 401 || res.status === 403) && options.onUnauthorized) {
        try {
          options.onUnauthorized(res.status);
        } catch {
          // The notifier should never throw, but if it does don't mask the original error.
        }
      }
      throw new ApiError(res.status, `${method} ${path} → ${res.status}`, errBody);
    }

    if (res.status === 204) return undefined as unknown as T;
    return (await res.json()) as T;
  }

  return {
    baseUrl: base,
    get: <T>(path: string) => request<T>("GET", path),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
    put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
    patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
    delete: <T>(path: string) => request<T>("DELETE", path),
  };
}
