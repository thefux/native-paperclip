
import { useState } from "react";
import { useInstanceStore } from "@/lib/store/instances";
import { createClient } from "@/lib/api/client";
import { Button, Card, Input } from "@/components/ui";

export function OnboardingScreen() {
  const add = useInstanceStore((s) => s.add);
  const setActive = useInstanceStore((s) => s.setActive);
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const client = createClient({ baseUrl, apiKey });
      const me = await client.get<{ id: string; companyId: string; role?: string }>(
        "/api/agents/me",
      );
      const instance = add({
        label: label || new URL(baseUrl).host,
        baseUrl,
        apiKey,
        defaultCompanyId: me.companyId,
        identity: { id: me.id, companyId: me.companyId, role: me.role },
      });
      setActive(instance.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to validate instance";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Connect a Paperclip instance</h1>
          <p className="text-sm text-muted">
            Add the API URL and an API key. The app will validate by calling{" "}
            <code className="font-mono text-xs">GET /api/agents/me</code>.
          </p>
        </header>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Label</span>
            <Input
              placeholder="Home, Work, etc."
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Base URL</span>
            <Input
              required
              type="url"
              placeholder="https://paperclip.example.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">API key</span>
            <Input
              required
              type="password"
              placeholder="pck_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Validating…" : "Connect"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
