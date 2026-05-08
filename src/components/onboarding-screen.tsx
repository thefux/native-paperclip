
import { useState } from "react";
import { useInstanceStore } from "@/lib/store/instances";
import { ApiError, createClient } from "@/lib/api/client";
import { resolveIdentity } from "@/lib/api/me";
import { Button, Card, Input } from "@/components/ui";

export function OnboardingScreen() {
  const add = useInstanceStore((s) => s.add);
  const setActive = useInstanceStore((s) => s.setActive);
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [companyIdInput, setCompanyIdInput] = useState("");
  const [needCompanyId, setNeedCompanyId] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const client = createClient({ baseUrl, apiKey });
      const identity = await resolveIdentity(
        client,
        needCompanyId && companyIdInput.trim() ? companyIdInput.trim() : null,
      );
      const instance = add({
        label: label || new URL(baseUrl).host,
        baseUrl,
        apiKey,
        defaultCompanyId: identity.companyId,
        identity: {
          id: identity.id ?? "",
          companyId: identity.companyId,
          role: identity.role,
          displayName: identity.displayName,
        },
      });
      setActive(instance.id);
    } catch (err) {
      const message = formatOnboardingError(err);
      setError(message);
      // If the manual-cid prompt is the only remaining path, surface the input.
      if (
        err instanceof ApiError &&
        err.status === 401 &&
        typeof err.body === "string" &&
        (err.body as string).includes("paste the company id")
      ) {
        setNeedCompanyId(true);
      } else if (
        err instanceof ApiError &&
        err.status === 401 &&
        !needCompanyId
      ) {
        // 401 with no /api/me → ask for cid as an escape hatch.
        setNeedCompanyId(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function formatOnboardingError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 401 || err.status === 403) {
        return "Token rejected by this instance. If it's a `pck_…` company key on a pre-ROU-58 deployment, paste the company id below to continue.";
      }
      if (err.status === 404) {
        return "Endpoint not found at that URL. Double-check the host + port (V2 listens on `:3210`).";
      }
      return `Server returned ${err.status}.`;
    }
    if (err instanceof TypeError) {
      return "Could not reach that URL. Confirm the instance is running and reachable from this device.";
    }
    return err instanceof Error ? err.message : "Failed to validate instance.";
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Connect a Paperclip instance</h1>
          <p className="text-sm text-muted">
            Paste the Paperclip URL and a <code className="font-mono text-xs">pck_…</code>{" "}
            API key (issued by{" "}
            <code className="font-mono text-xs">POST /api/companies/:cid/api-keys</code>). The
            app validates with <code className="font-mono text-xs">GET /api/me</code> (falling
            back to <code className="font-mono text-xs">GET /api/agents/me</code> for older
            deployments) and stores the secret in the OS keystore.
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
              placeholder="http://192.168.x.x:3210"
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
          {needCompanyId && (
            <label className="block space-y-1 text-sm">
              <span className="text-muted">
                Company id <span className="text-xs">(only required for pre-ROU-58 instances)</span>
              </span>
              <Input
                placeholder="00000000-0000-0000-0000-000000000000"
                value={companyIdInput}
                onChange={(e) => setCompanyIdInput(e.target.value)}
              />
            </label>
          )}
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
