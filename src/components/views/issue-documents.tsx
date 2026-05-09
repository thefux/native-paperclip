import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useActiveClient } from "@/lib/store/use-active-client";
import { documentsApi } from "@/lib/api/documents";
import { ApiError } from "@/lib/api/client";
import { Button, Card } from "@/components/ui";
import type { IssueDocument, IssueDocumentSummary } from "@/lib/api/types";
import { FileText, Plus } from "lucide-react";

/**
 * List + view + edit issue documents. Documents are server-managed markdown
 * blobs with optimistic concurrency via `baseRevisionId`. Common keys used in
 * Paperclip: `plan`, `api-keys`, `notes`, etc. — keys are free-form strings.
 */
export function IssueDocuments({ issueId }: { issueId: string }) {
  const { client, prefix } = useActiveClient();
  const qc = useQueryClient();

  const list = useQuery<IssueDocumentSummary[]>({
    queryKey: [prefix, "documents", issueId] as const,
    queryFn: () => (client ? documentsApi.list(client, issueId) : Promise.resolve([])),
    enabled: !!client,
    retry: false,
  });

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  // Default to opening the first document, if any.
  useEffect(() => {
    if (!activeKey && list.data && list.data.length > 0) {
      setActiveKey(list.data[0].key);
    }
  }, [activeKey, list.data]);

  if (!client) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <FileText size={14} className="text-muted" />
        <span className="text-xs uppercase tracking-wide text-muted">Documents</span>
        {list.data?.map((doc) => (
          <button
            key={doc.key}
            onClick={() => {
              setActiveKey(doc.key);
              setCreatingNew(false);
            }}
            className={`rounded-full border border-border px-2 py-0.5 text-xs transition-colors ${
              activeKey === doc.key && !creatingNew
                ? "bg-accent/15 border-accent text-fg"
                : "text-muted hover:text-fg"
            }`}
          >
            {doc.title ?? doc.key}
          </button>
        ))}
        <Button
          variant="ghost"
          className="ml-auto px-2 py-0.5 text-xs"
          onClick={() => {
            setCreatingNew(true);
            setActiveKey(null);
          }}
        >
          <Plus size={12} className="mr-1" />
          New
        </Button>
      </div>

      {list.isError && (
        <Card className="border-yellow-500/40 bg-yellow-500/5 text-sm text-muted">
          Documents unavailable: {(list.error as Error).message}
        </Card>
      )}

      {list.data?.length === 0 && !creatingNew && (
        <Card>
          <p className="text-sm text-muted">No documents on this issue yet.</p>
        </Card>
      )}

      {activeKey && !creatingNew && (
        <DocumentEditor
          issueId={issueId}
          docKey={activeKey}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: [prefix, "documents", issueId] });
            qc.invalidateQueries({ queryKey: [prefix, "document", issueId, activeKey] });
          }}
        />
      )}

      {creatingNew && (
        <NewDocumentForm
          issueId={issueId}
          onClose={() => setCreatingNew(false)}
          onCreated={(key) => {
            qc.invalidateQueries({ queryKey: [prefix, "documents", issueId] });
            setCreatingNew(false);
            setActiveKey(key);
          }}
        />
      )}
    </div>
  );
}

function DocumentEditor({
  issueId,
  docKey,
  onSaved,
}: {
  issueId: string;
  docKey: string;
  onSaved: () => void;
}) {
  const { client, prefix } = useActiveClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const doc = useQuery<IssueDocument | null>({
    queryKey: [prefix, "document", issueId, docKey] as const,
    queryFn: () => (client ? documentsApi.get(client, issueId, docKey) : Promise.resolve(null)),
    enabled: !!client,
  });

  useEffect(() => {
    if (doc.data) setDraft(doc.data.body);
  }, [doc.data?.id, doc.data?.latestRevisionId]);

  const save = useMutation({
    mutationFn: async () => {
      if (!client || !doc.data) throw new Error("No document loaded");
      return documentsApi.put(client, issueId, docKey, {
        title: doc.data.title,
        format: doc.data.format,
        body: draft,
        baseRevisionId: doc.data.latestRevisionId,
      });
    },
    onSuccess: () => {
      setError(null);
      setEditing(false);
      onSaved();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const body = err.body as { message?: string; error?: string } | undefined;
        setError(body?.message ?? body?.error ?? `${err.status}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to save document");
      }
    },
  });

  if (doc.isLoading) return <Card><p className="text-sm text-muted">Loading document…</p></Card>;
  if (doc.isError)
    return (
      <Card className="border-red-500/40 bg-red-500/5">
        <p className="text-sm text-red-400">{(doc.error as Error).message}</p>
      </Card>
    );
  if (!doc.data) return null;

  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted">{doc.data.key}</span>
        <span className="text-sm font-medium">{doc.data.title ?? "(untitled)"}</span>
        <span className="ml-auto text-xs text-muted">
          rev {doc.data.latestRevisionNumber ?? "?"}
        </span>
        {editing ? (
          <Button
            variant="ghost"
            className="text-xs"
            onClick={() => {
              setEditing(false);
              setDraft(doc.data!.body);
              setError(null);
            }}
          >
            Cancel
          </Button>
        ) : (
          <Button variant="ghost" className="text-xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        {editing && (
          <Button
            className="text-xs"
            onClick={() => save.mutate()}
            disabled={save.isPending || draft === doc.data!.body}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        )}
      </div>

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={Math.min(24, Math.max(8, draft.split("\n").length + 2))}
          className="w-full rounded-md border border-border bg-bg p-3 font-mono text-xs"
        />
      ) : (
        <pre className="max-h-[24rem] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-bg/50 p-3 font-mono text-xs">
          {doc.data.body}
        </pre>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </Card>
  );
}

function NewDocumentForm({
  issueId,
  onClose,
  onCreated,
}: {
  issueId: string;
  onClose: () => void;
  onCreated: (key: string) => void;
}) {
  const { client } = useActiveClient();
  const [docKey, setDocKey] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("No active connection");
      if (!docKey.trim()) throw new Error("Key is required");
      return documentsApi.put(client, issueId, docKey.trim(), {
        title: title.trim() || undefined,
        format: "markdown",
        body,
        baseRevisionId: null,
      });
    },
    onSuccess: (doc) => onCreated(doc.key),
    onError: (err) => {
      if (err instanceof ApiError) {
        const b = err.body as { message?: string; error?: string } | undefined;
        setError(b?.message ?? b?.error ?? `${err.status}: ${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : "Failed to create document");
      }
    },
  });

  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">New document</span>
        <Button variant="ghost" className="ml-auto text-xs" onClick={onClose}>
          Cancel
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <input
          className="rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-xs"
          placeholder="key (e.g. plan, notes, api-keys)"
          value={docKey}
          onChange={(e) => setDocKey(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
        />
        <input
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <textarea
        className="w-full rounded-md border border-border bg-bg p-3 font-mono text-xs"
        rows={10}
        placeholder="Markdown body…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={() => create.mutate()} disabled={create.isPending || !docKey.trim()}>
          {create.isPending ? "Creating…" : "Create document"}
        </Button>
      </div>
    </Card>
  );
}
