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

export function createClient(instance: Pick<Instance, "baseUrl" | "apiKey">) {
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
      throw new ApiError(res.status, `${method} ${path} → ${res.status}`, errBody);
    }

    if (res.status === 204) return undefined as unknown as T;
    return (await res.json()) as T;
  }

  return {
    baseUrl: base,
    get: <T>(path: string) => request<T>("GET", path),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
    patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
    delete: <T>(path: string) => request<T>("DELETE", path),
  };
}
