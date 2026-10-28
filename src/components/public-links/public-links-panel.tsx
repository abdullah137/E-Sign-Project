"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Label, Select, FormField } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import { formatDate, formatDateTime } from "@/lib/format";
import type { PublicLinkSummary } from "@/lib/templates";

export interface PublicTemplateOption {
  id: string;
  name: string;
  fieldCount: number;
}

export function PublicLinksPanel({
  links,
  templates,
  canManage,
  showDevOutbox,
}: {
  links: PublicLinkSummary[];
  templates: PublicTemplateOption[];
  canManage: boolean;
  showDevOutbox: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [name, setName] = useState("");
  const [days, setDays] = useState("30");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<PublicLinkSummary | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<PublicLinkSummary | null>(null);

  const openCreate = () => {
    setTemplateId(templates[0]?.id ?? "");
    setName(templates[0]?.name ? `${templates[0].name} request` : "");
    setDays("30");
    setError(null);
    setCreated(null);
    setCreating(true);
  };

  const copy = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: "Link copied" });
    } catch {
      setError("Copying failed. Select the URL and copy it manually.");
    }
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch<{ link: PublicLinkSummary }>("/api/public-links", {
        method: "POST",
        body: JSON.stringify({
          templateId,
          name: name.trim(),
          expiresInDays: Number(days),
        }),
      });
      setCreated(result.link);
      toast({ title: "Public link created", variant: "success" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The link could not be created.");
    } finally {
      setSaving(false);
    }
  };

  const revoke = async () => {
    if (!revoking) return;
    await apiFetch(`/api/public-links/${revoking.id}`, { method: "DELETE" });
    toast({ title: "Public link revoked" });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-[12.5px] leading-5 text-slate">
          A public link lets someone start a single-recipient template after verifying their email.
          SignFlow creates the document, sends the signing invitation and keeps the audit trail.
        </p>
        {canManage ? (
          <Button size="sm" onClick={openCreate} disabled={!templates.length}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Create link
          </Button>
        ) : null}
      </div>

      {links.length ? (
        <div className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface">
          {links.map((link) => {
            const inactive = link.status !== "active" || link.expired;
            return (
              <div key={link.id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[13.5px] font-semibold text-ink">{link.name}</h2>
                      {link.status === "revoked" ? (
                        <Badge tone="danger">Revoked</Badge>
                      ) : link.expired ? (
                        <Badge tone="muted">Expired</Badge>
                      ) : (
                        <Badge tone="success">Active</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] text-slate">
                      Template:{" "}
                      <Link
                        href="/app/templates"
                        className="text-ink-secondary underline-offset-2 hover:underline"
                      >
                        {link.templateName}
                      </Link>
                      {" · "}
                      {link.uses} verified {link.uses === 1 ? "use" : "uses"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate">
                      Created {formatDate(link.createdAt)} ·{" "}
                      {link.expiresAt ? `Expires ${formatDate(link.expiresAt)}` : "No expiry"} · Last used{" "}
                      {link.lastUsedAt ? formatDateTime(link.lastUsedAt) : "never"}
                    </p>
                    {!inactive ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <code className="max-w-full truncate rounded border border-hairline bg-surface-subtle px-2.5 py-1.5 font-mono text-[11px] text-ink-secondary">
                          {link.url}
                        </code>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => copy(link.url, link.id)}
                          aria-label="Copy public link"
                        >
                          {copiedId === link.id ? (
                            <Check className="h-3.5 w-3.5 text-success-text" aria-hidden="true" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          Copy
                        </Button>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center gap-1.5 rounded px-2.5 text-[12.5px] font-medium text-slate hover:bg-surface-subtle hover:text-ink"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          Open
                        </a>
                      </div>
                    ) : null}
                  </div>
                  {canManage && link.status === "active" ? (
                    <Button size="sm" variant="ghost" onClick={() => setRevoking(link)}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Revoke
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={<Link2 className="h-5 w-5" aria-hidden="true" />}
            title="No public links yet"
            description="Create a single-recipient template first. Then publish a link that requests the template by verified email."
            action={
              <Link
                href="/app/templates"
                className="text-[13px] font-medium text-gold-text hover:underline"
              >
                Go to templates
              </Link>
            }
          />
        </div>
      )}

      <section className="rounded-card border border-hairline bg-surface-subtle/40 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-text" aria-hidden="true" />
          <div>
            <p className="text-[12.5px] font-medium text-ink">How verification works</p>
            <ul className="mt-1.5 space-y-1 text-[12px] leading-5 text-slate">
              <li>1. The visitor enters their name and email on the public page.</li>
              <li>2. SignFlow emails a six-digit code, valid for ten minutes and one use.</li>
              <li>3. After verification, a draft is created for that person and sent immediately.</li>
              <li>4. Only templates with exactly one recipient can be published this way.</li>
            </ul>
            {showDevOutbox ? (
              <Link
                href="/dev/outbox"
                className="mt-2 inline-block text-[12px] font-medium text-gold-text hover:underline"
              >
                Inspect codes in the development outbox
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <Modal
        open={creating}
        onClose={() => (saving ? undefined : setCreating(false))}
        title={created ? "Your public link" : "Create a public link"}
        description={
          created
            ? "Share this URL. It can be copied again from the list at any time."
            : "The link resolves to a single-recipient template. Requests are verified by email."
        }
        footer={
          created ? (
            <Button onClick={() => setCreating(false)}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={create} loading={saving} disabled={!templateId}>
                Create link
              </Button>
            </>
          )
        }
      >
        {created ? (
          <div className="space-y-3">
            <Label htmlFor="createdPublicUrl">Public URL</Label>
            <div className="flex items-start gap-2">
              <Input
                id="createdPublicUrl"
                readOnly
                value={created.url}
                className="font-mono text-[11.5px]"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                size="icon"
                variant="secondary"
                onClick={() => copy(created.url, created.id)}
                aria-label="Copy public link"
              >
                {copiedId === created.id ? (
                  <Check className="h-4 w-4 text-success-text" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
            <p className="text-[11.5px] leading-5 text-slate">
              Expires {formatDate(created.expiresAt)}. Revoke it from this page at any time.
            </p>
          </div>
        ) : (
          <form onSubmit={create} className="space-y-4">
            <FormField label="Template" htmlFor="publicTemplate" required>
              <Select
                id="publicTemplate"
                value={templateId}
                onChange={(event) => {
                  setTemplateId(event.target.value);
                  const template = templates.find((item) => item.id === event.target.value);
                  if (template) setName(`${template.name} request`);
                }}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} · {template.fieldCount} field
                    {template.fieldCount === 1 ? "" : "s"}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Link name" htmlFor="publicLinkName" required hint="Internal label only.">
              <Input
                id="publicLinkName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
              />
            </FormField>
            <FormField label="Expiry" htmlFor="publicLinkDays">
              <Select id="publicLinkDays" value={days} onChange={(event) => setDays(event.target.value)}>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </Select>
            </FormField>
            {error ? <p className="text-[12px] leading-5 text-danger">{error}</p> : null}
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        onConfirm={revoke}
        title="Revoke this public link?"
        description={
          revoking
            ? `${revoking.name} will stop accepting new requests. Documents already created keep their own links.`
            : undefined
        }
        confirmLabel="Revoke link"
      >
        <p className="text-[12px] leading-5 text-slate">
          You can create a new link for the same template later.
        </p>
      </ConfirmDialog>
    </div>
  );
}
