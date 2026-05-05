import { useInstanceStore } from "@/lib/store/instances";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { Workspace } from "@/components/workspace";

export function HomeApp() {
  const hydrated = useInstanceStore((s) => s.hydrated);
  const instances = useInstanceStore((s) => s.instances);
  const activeId = useInstanceStore((s) => s.activeId);

  if (!hydrated) {
    return (
      <main className="grid min-h-screen place-items-center text-muted">
        <span className="animate-pulse">Loading…</span>
      </main>
    );
  }

  if (instances.length === 0 || !activeId) {
    return <OnboardingScreen />;
  }

  return <Workspace />;
}
