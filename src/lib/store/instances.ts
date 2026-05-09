
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createSecretStorage } from "@/lib/store/secret-storage";

export interface InstanceIdentity {
  /** Agent or user id resolved by `/api/me` (or `/api/agents/me` fallback). May be empty for manual-cid onboarding. */
  id: string;
  companyId: string;
  /** Company display name resolved at onboarding (and refreshed on activation). */
  companyName?: string;
  /** Agent role string when actor is an agent; for board/user actors falls back to actor type. */
  role?: string;
  /** Display name for the agent / user / company in that order of preference. */
  displayName?: string;
  /** Source of the identity data — useful for telling pck_/agent/manual paths apart in UI. */
  source?: "api/me" | "agents/me" | "manual-cid";
  /** Last successful identity validation. Used by the activation refresh hook. */
  lastValidatedAt?: string;
}

export type ConnectionHealth = "ok" | "degraded" | "unknown";

export interface Instance {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  defaultCompanyId?: string;
  identity?: InstanceIdentity;
  /** Set to "degraded" when the last call returned 401/403; "ok" once a fresh /api/me succeeds. */
  health?: ConnectionHealth;
  /** Last `Date#toISOString()` we wrote to identity. Mirrors `identity.lastValidatedAt` for convenience. */
  lastSeenAt?: string;
}

interface InstanceState {
  instances: Instance[];
  activeId: string | null;
  hydrated: boolean;
  add: (instance: Omit<Instance, "id">) => Instance;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<Instance>) => void;
  /** Marks an instance's `health`. Use when a request unexpectedly 401/403s. */
  setHealth: (id: string, health: ConnectionHealth) => void;
  setActive: (id: string | null) => void;
  setHydrated: (hydrated: boolean) => void;
  active: () => Instance | undefined;
  /** Convenience: is the active connection visibly degraded? */
  activeIsDegraded: () => boolean;
}

const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const useInstanceStore = create<InstanceState>()(
  persist(
    (set, get) => ({
      instances: [],
      activeId: null,
      hydrated: false,

      add: (input) => {
        const instance: Instance = { ...input, id: newId() };
        set((s) => ({
          instances: [...s.instances, instance],
          activeId: s.activeId ?? instance.id,
        }));
        return instance;
      },

      remove: (id) =>
        set((s) => {
          const instances = s.instances.filter((i) => i.id !== id);
          const activeId = s.activeId === id ? (instances[0]?.id ?? null) : s.activeId;
          return { instances, activeId };
        }),

      update: (id, patch) =>
        set((s) => ({
          instances: s.instances.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),

      setHealth: (id, health) =>
        set((s) => ({
          instances: s.instances.map((i) =>
            i.id === id
              ? {
                  ...i,
                  health,
                  lastSeenAt: health === "ok" ? new Date().toISOString() : i.lastSeenAt,
                }
              : i,
          ),
        })),

      setActive: (id) => set({ activeId: id }),
      setHydrated: (hydrated) => set({ hydrated }),
      active: () => get().instances.find((i) => i.id === get().activeId),
      activeIsDegraded: () => {
        const a = get().instances.find((i) => i.id === get().activeId);
        return a?.health === "degraded";
      },
    }),
    {
      name: "native-paperclip:instances",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return createSecretStorage();
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
      partialize: (s) => ({ instances: s.instances, activeId: s.activeId }),
    },
  ),
);
