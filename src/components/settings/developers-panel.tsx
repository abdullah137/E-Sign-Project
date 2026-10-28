"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Code2, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, FormField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import { formatDate, formatDateTime } from "@/lib/format";
import type { ApiKeySummary } from "@/lib/workspace-admin";

export function DevelopersPanel({
  keys,
  isAdmin,
}: {
  keys: ApiKeySummary[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ key: string; prefix: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<ApiKeySummary | null>(null);

  const active = keys.filter((key) => !key.revokedAt);
  const revoked = keys.filter((key) => key.revokedAt);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch<{ key: string; prefix: string }>(
        "/api/workspace/api-keys",
        { method: "POST", body: JSON.stringify({ label }) },
      );
      setCreating(false);
      setLabel("");
      setRevealed({ key: result.key, prefix: result.prefix });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The key could not be created.");
    } finally {
      setSaving(false);
    }
  };

  const copyKey = async () => {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copying failed. Select the key and copy it manually.");
    }
  };

  const revoke = async () => {
    if (!revoking) return;
    await apiFetch(`/api/workspace/api-keys/${revoking.id}`, { method: "DELETE" });
    toast({ title: "API key revoked", description: `${revoking.label} can no longer authenticate.` });
    router.refresh();
  };

  const curl = `curl "$SIGNFLOW_URL/api/v1/documents?limit=10" \\
  -H "Authorization: Bearer sf_live_..."`;

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-subtle text-slate">
              <KeyRound className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-ink">API keys</h2>
              <p className="mt-0.5 text-[12px] leading-5 text-slate">
                Read documents from your workspace with a scoped server key.
              </p>
            </div>
          </div>
          {isAdmin ? (
            <Button size="sm" onClick={() => setCreating(true)} disabled={active.length >= 10}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Create key
            </Button>
          ) : null}
        </div>

        {!isAdmin ? (
          <p className="mt-4 rounded border border-hairline bg-surface-subtle/60 px-4 py-3 text-[12px] text-slate">
            Only workspace owners and admins can manage API keys.
          </p>
        ) : active.length ? (
          <div className="mt-5 divide-y divide-hairline border-t border-hairline">
            {active.map((key) => (
              <div key={key.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[13px] font-medium text-ink">{key.label}</p>
                    <Badge tone="success">Active</Badge>
                  </div>
                  <p className="mt-1 font-mono text-[11.5px] text-slate">
                    {key.prefix}••••••••••••
                  </p>
                  <p className="mt-1 text-[11px] text-slate">
                    Created {formatDate(key.createdAt)} · Last used{" "}
                    {key.lastUsedAt ? formatDateTime(key.lastUsedAt) : "never"}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setRevoking(key)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded border border-hairline bg-surface-subtle/50 px-4 py-3 text-[12px] text-slate">
            No active keys. Create one to start querying the API.
          </p>
        )}

        {revoked.length ? (
          <details className="mt-5 border-t border-hairline pt-4">
            <summary className="cursor-pointer text-[12px] font-medium text-slate hover:text-ink">
              {revoked.length} revoked key{revoked.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-3 space-y-2">
              {revoked.map((key) => (
                <li key={key.id} className="flex items-center justify-between text-[12px] text-slate">
                  <span className="truncate pr-3">{key.label}</span>
                  <span className="shrink-0 text-[11px]">Revoked {formatDate(key.revokedAt)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="card p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-subtle text-slate">
            <Code2 className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-ink">REST API</h2>
            <p className="mt-0.5 text-[12px] leading-5 text-slate">
              Authenticate with <code className="rounded bg-surface-subtle px-1 py-0.5 font-mono text-[11px]">Authorization: Bearer …</code> or an{" "}
              <code className="rounded bg-surface-subtle px-1 py-0.5 font-mono text-[11px]">x-api-key</code> header.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-success-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold text-success-text">
                GET
              </span>
              <code className="font-mono text-[12.5px] text-ink">/api/v1/documents</code>
            </div>
            <p className="mt-1.5 text-[12px] leading-5 text-slate">
              Returns documents with status, recipient counts and timestamps. Supports{" "}
              <code className="font-mono text-[11px]">status</code>,{" "}
              <code className="font-mono text-[11px]">limit</code> and{" "}
              <code className="font-mono text-[11px]">offset</code>.
            </p>
            <pre className="mt-2 overflow-x-auto rounded border border-hairline bg-surface-subtle/60 p-3 font-mono text-[11.5px] leading-5 text-ink-secondary">
              {curl}
            </pre>
          </div>
          <div>
            <p className="text-[12px] font-medium text-ink">Response</p>
            <pre className="mt-1.5 overflow-x-auto rounded border border-hairline bg-surface-subtle/60 p-3 font-mono text-[11.5px] leading-5 text-ink-secondary">
{`{
  "data": [
    { "id": "doc_…", "title": "Mutual NDA",
      "status": "pending", "recipients": 2, "signed": 0 }
  ],
  "pagination": { "total": 12, "limit": 10, "offset": 0 }
}`}
            </pre>
          </div>
        </div>

        <div className="mt-5 rounded border border-hairline bg-surface-subtle/50 px-4 py-3">
          <p className="text-[12px] font-medium text-ink">Not available in this deployment</p>
          <p className="mt-0.5 text-[11.5px] leading-5 text-slate">
            Write endpoints, webhooks and OAuth apps from the product roadmap are not implemented. Only the read endpoint above is live.
          </p>
        </div>
      </section>

      <Modal
        open={creating}
        onClose={() => (saving ? undefined : setCreating(false))}
        title="Create an API key"
        description="The key is shown once. Store it in a secret manager — only a hash is retained."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={create} loading={saving} disabled={label.trim().length < 2}>
              Create key
            </Button>
          </>
        }
      >
        <form onSubmit={create} className="space-y-4">
          <FormField label="Label" htmlFor="keyLabel" required hint="For example: Production reporting job.">
            <Input
              id="keyLabel"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={60}
              required
              autoFocus
            />
          </FormField>
          {error ? <p className="text-[12px] leading-5 text-danger">{error}</p> : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(revealed)}
        onClose={() => setRevealed(null)}
        title="Copy your API key"
        description="This is the only time the full key is displayed. Requests fail once it is revoked."
        size="sm"
        footer={
          <Button onClick={() => setRevealed(null)}>Done</Button>
        }
      >
        {revealed ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <code className="min-w-0 flex-1 break-all rounded border border-hairline bg-surface-subtle px-3 py-2.5 font-mono text-[11.5px] leading-5 text-ink">
                {revealed.key}
              </code>
              <Button size="icon" variant="secondary" onClick={copyKey} aria-label="Copy API key">
                {copied ? (
                  <Check className="h-4 w-4 text-success-text" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
            <p className="text-[11.5px] leading-5 text-slate">
              Prefix <span className="font-mono">{revealed.prefix}</span> identifies this key in logs. Revoke it here if it leaks.
            </p>
            {error ? <p className="text-[12px] text-danger">{error}</p> : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        onConfirm={revoke}
        title="Revoke this API key?"
        description={
          revoking
            ? `Requests using ${revoking.label} will fail immediately. This cannot be undone.`
            : undefined
        }
        confirmLabel="Revoke key"
      >
        <p className="text-[12px] leading-5 text-slate">
          Create a replacement key first if another integration depends on access.
        </p>
      </ConfirmDialog>
    </div>
  );
}
