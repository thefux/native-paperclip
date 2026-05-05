import dynamic from "next/dynamic";

const HomeApp = dynamic(() => import("@/components/home-app").then((m) => m.HomeApp), {
  ssr: false,
  loading: () => (
    <main className="grid min-h-screen place-items-center text-muted">
      <span className="animate-pulse">Loading…</span>
    </main>
  ),
});

export default function IndexPage() {
  return <HomeApp />;
}
