import type { StateStorage } from "zustand/middleware";

/**
 * Build a `zustand/middleware` `StateStorage` adapter that prefers the Tauri
 * `tauri-plugin-store` keystore (file-encrypted on the device) and silently
 * falls back to `window.localStorage` when running in a browser preview where
 * the Tauri runtime is absent. The plugin-store implementation is loaded
 * lazily so the web bundle stays functional without `@tauri-apps/api` IPC.
 *
 * `pck_…` API keys live in the persisted blob so do NOT log values; only log
 * keys/operations.
 */
export function createSecretStorage(filename = "paperclip-secrets.json"): StateStorage {
  type StorePlugin = {
    get: <T = unknown>(key: string) => Promise<T | null>;
    set: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<boolean>;
    save: () => Promise<void>;
  };

  let storePromise: Promise<StorePlugin | null> | null = null;

  function isTauri(): boolean {
    if (typeof window === "undefined") return false;
    const w = window as unknown as Record<string, unknown>;
    return Boolean(w.__TAURI_INTERNALS__ ?? w.__TAURI__ ?? w.__TAURI_IPC__);
  }

  async function loadStore(): Promise<StorePlugin | null> {
    if (!isTauri()) return null;
    try {
      const mod: unknown = await import(
        /* webpackIgnore: true */ "@tauri-apps/plugin-store"
      );
      const loader = (mod as { load?: (path: string) => Promise<StorePlugin> }).load;
      if (!loader) return null;
      return await loader(filename);
    } catch {
      return null;
    }
  }

  function ensureStore(): Promise<StorePlugin | null> {
    storePromise ??= loadStore();
    return storePromise;
  }

  function lsGet(name: string): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  }

  function lsSet(name: string, value: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* quota / privacy modes — best-effort only */
    }
  }

  function lsRemove(name: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  }

  return {
    async getItem(name) {
      const store = await ensureStore();
      if (store) {
        const value = await store.get<string>(name);
        if (typeof value === "string") return value;
        const ls = lsGet(name);
        if (ls !== null) {
          await store.set(name, ls);
          await store.save();
          lsRemove(name);
          return ls;
        }
        return null;
      }
      return lsGet(name);
    },
    async setItem(name, value) {
      const store = await ensureStore();
      if (store) {
        await store.set(name, value);
        await store.save();
        lsRemove(name);
        return;
      }
      lsSet(name, value);
    },
    async removeItem(name) {
      const store = await ensureStore();
      if (store) {
        await store.delete(name);
        await store.save();
      }
      lsRemove(name);
    },
  };
}
