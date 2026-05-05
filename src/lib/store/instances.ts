
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface Instance {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  defaultCompanyId?: string;
  identity?: {
    id: string;
    companyId: string;
    role?: string;
    displayName?: string;
  };
}

interface InstanceState {
  instances: Instance[];
  activeId: string | null;
  hydrated: boolean;
  add: (instance: Omit<Instance, "id">) => Instance;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<Instance>) => void;
  setActive: (id: string | null) => void;
  setHydrated: (hydrated: boolean) => void;
  active: () => Instance | undefined;
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

      setActive: (id) => set({ activeId: id }),
      setHydrated: (hydrated) => set({ hydrated }),
      active: () => get().instances.find((i) => i.id === get().activeId),
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
        return window.localStorage;
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
      partialize: (s) => ({ instances: s.instances, activeId: s.activeId }),
    },
  ),
);
