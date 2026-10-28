"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  FileStack,
  LayoutTemplate,
  Link2,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Label, Select, FormField, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/format";
import type { TemplateSummary } from "@/lib/templates";

export interface TemplateCandidate {
  id: string;
  title: string;
  status: string;
  fieldCount: number;
  recipientCount: number;
}

export function TemplatesPanel({
  templates,
  candidates,
  canManage,
}: {
  templates: TemplateSummary[];
  candidates: TemplateCandidate[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [documentId, setDocumentId] = useState(candidates[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [using, setUsing] = useState<TemplateSummary | null>(null);
  const [recipients, setRecipients] = useState<Array<{ name: string; email: string }>>([]);
  const [usingError, setUsingError] = useState<string | null>(null);
  const [usingSaving, setUsingSaving] = useState(false);

  const [deleting, setDeleting] = useState<TemplateSummary | null>(null);

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === documentId) ?? null,
    [candidates, documentId],
  );

  const openCreate = () => {
    setError(null);
    setDocumentId(candidates[0]?.id ?? "");
    setName("");
    setDescription("");
    setCreating(true);
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!documentId) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/templates", {
        method: "POST",
        body: JSON.stringify({
          documentId,
          name: name.trim() || selectedCandidate?.title || "Untitled template",
          description: description.trim() || null,
        }),
      });
      toast({ title: "Template saved", variant: "success" });
      setCreating(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The template could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const openUse = (template: TemplateSummary) => {
    setUsing(template);
    setUsingError(null);
    setRecipients(
      template.recipientSlots.map((slot, index) => ({
        name: slot.name || `Recipient ${index + 1}`,
        email: "",
      })),
    );
  };

  const useTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!using) return;
    setUsingSaving(true);
    setUsingError(null);
    try {
      const result = await apiFetch<{ documentId: string }>(
        `/api/templates/${using.id}/use`,
        { method: "POST", body: JSON.stringify({ recipients }) },
      );
      toast({ title: "Draft created", description: "Review the recipients, then send it." });
      router.push(`/app/documents/${result.documentId}`);
    } catch (err) {
      setUsingError(err instanceof Error ? err.message : "The template could not be used.");
      setUsingSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    await apiFetch(`/api/templates/${deleting.id}`, { method: "DELETE" });
    toast({ title: "Template removed" });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12.5px] leading-5 text-slate">
          Templates keep the PDF, recipients and field layout together. Using one creates a fresh draft.
        </p>
        {canManage ? (
          <Button size="sm" onClick={openCreate} disabled={!candidates.length}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            New template
          </Button>
        ) : null}
      </div>

      {templates.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((template) => (
            <article key={template.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-subtle text-slate">
                  <LayoutTemplate className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div className="flex items-center gap-1.5">
                  {template.publicLinkCount > 0 ? (
                    <Badge tone="gold">{template.publicLinkCount} public</Badge>
                  ) : null}
                  <Badge tone="neutral">{template.pageCount} pages</Badge>
                </div>
              </div>
              <h2 className="mt-3 text-[15px] font-semibold leading-6 text-ink">{template.name}</h2>
              {template.description ? (
                <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate">{template.description}</p>
              ) : (
                <p className="mt-1 text-[12px] leading-5 text-slate">
                  Saved from {template.sourceFilename}
                </p>
              )}

              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-hairline pt-3">
                <div>
                  <dt className="overline">Fields</dt>
                  <dd className="mt-0.5 text-[13px] font-medium text-ink">{template.fieldCount}</dd>
                </div>
                <div>
                  <dt className="overline">Recipients</dt>
                  <dd className="mt-0.5 text-[13px] font-medium text-ink">
                    {template.recipientSlots.length}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] text-slate">Updated {formatDate(template.updatedAt)}</p>

              <div className="mt-4 flex items-center gap-2 border-t border-hairline pt-4">
                <Button size="sm" onClick={() => openUse(template)} className="flex-1">
                  Use template
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                {template.publicLinkCount > 0 ? (
                  <Link
                    href="/app/public-links"
                    className="inline-flex h-9 items-center gap-1.5 rounded border border-[rgba(18,20,23,0.12)] px-3 text-[12.5px] font-medium text-ink hover:bg-surface-subtle"
                  >
                    <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Links
                  </Link>
                ) : null}
                {canManage ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleting(template)}
                    aria-label={`Delete ${template.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={<FileStack className="h-5 w-5" aria-hidden="true" />}
            title="No templates yet"
            description="Prepare a document with recipients and fields, then save it as a template to reuse the layout."
            action={
              canManage && candidates.length ? (
                <Button onClick={openCreate}>Create your first template</Button>
              ) : (
                <Link
                  href="/app/documents"
                  className="text-[13px] font-medium text-gold-text hover:underline"
                >
                  Prepare a document first
                </Link>
              )
            }
          />
        </div>
      )}

      <section className="rounded-card border border-hairline bg-surface-subtle/40 p-5">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-gold-text" aria-hidden="true" />
          <div>
            <p className="text-[12.5px] font-medium text-ink">How templates differ from documents</p>
            <p className="mt-1 text-[12px] leading-5 text-slate">
              A template stores the original PDF and field geometry, not signatures. Using it creates a
              separate draft with its own audit trail. Changes made to the draft never flow back into the
              template.
            </p>
          </div>
        </div>
      </section>

      <Modal
        open={creating}
        onClose={() => (saving ? undefined : setCreating(false))}
        title="Create a template"
        description="Choose a prepared document. Its PDF, recipients and fields become the template."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={create} loading={saving} disabled={!documentId}>
              Save template
            </Button>
          </>
        }
      >
        <form onSubmit={create} className="space-y-4">
          {candidates.length ? (
            <>
              <FormField label="Source document" htmlFor="sourceDocument" required>
                <Select
                  id="sourceDocument"
                  value={documentId}
                  onChange={(event) => setDocumentId(event.target.value)}
                >
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.title} · {candidate.fieldCount} field
                      {candidate.fieldCount === 1 ? "" : "s"} · {candidate.recipientCount} recipient
                      {candidate.recipientCount === 1 ? "" : "s"}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                label="Template name"
                htmlFor="templateName"
                required
                hint="Defaults to the document title. Keep it recognisable for your team."
              >
                <Input
                  id="templateName"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  placeholder={selectedCandidate?.title}
                />
              </FormField>
              <FormField label="Description" htmlFor="templateDescription" hint="Optional. 280 characters.">
                <Textarea
                  id="templateDescription"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={280}
                  rows={3}
                />
              </FormField>
            </>
          ) : (
            <p className="text-[12.5px] leading-5 text-slate">
              No prepared documents are available. Add recipients and fields to a document first.
            </p>
          )}
          {error ? <p className="text-[12px] leading-5 text-danger">{error}</p> : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(using)}
        onClose={() => (usingSaving ? undefined : setUsing(null))}
        title={`Use ${using?.name ?? "template"}`}
        description="Provide the recipients for this copy. Each field keeps its position and required state."
        footer={
          <>
            <Button variant="secondary" onClick={() => setUsing(null)} disabled={usingSaving}>
              Cancel
            </Button>
            <Button onClick={useTemplate} loading={usingSaving}>
              Create draft
            </Button>
          </>
        }
      >
        <form onSubmit={useTemplate} className="space-y-4">
          {using?.recipientSlots.map((slot, index) => (
            <div key={`${slot.index}-${index}`} className="rounded border border-hairline p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-overline text-slate">
                Recipient {index + 1}
              </p>
              <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`template-recipient-name-${index}`}>Name</Label>
                  <Input
                    id={`template-recipient-name-${index}`}
                    value={recipients[index]?.name ?? ""}
                    maxLength={120}
                    placeholder={slot.name || "Full name"}
                    onChange={(event) =>
                      setRecipients((current) =>
                        current.map((recipient, position) =>
                          position === index ? { ...recipient, name: event.target.value } : recipient,
                        ),
                      )
                    }
                  />
                </div>
                <div>
                  <Label htmlFor={`template-recipient-email-${index}`} required>
                    Email
                  </Label>
                  <Input
                    id={`template-recipient-email-${index}`}
                    type="email"
                    value={recipients[index]?.email ?? ""}
                    maxLength={200}
                    placeholder="name@company.com"
                    required
                    onChange={(event) =>
                      setRecipients((current) =>
                        current.map((recipient, position) =>
                          position === index ? { ...recipient, email: event.target.value } : recipient,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            </div>
          ))}
          {usingError ? <p className="text-[12px] leading-5 text-danger">{usingError}</p> : null}
          <p className="text-[11.5px] leading-5 text-slate">
            The new draft opens in the field editor. Sending is a separate step, after you review the
            copy.
          </p>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete this template?"
        description={
          deleting
            ? `${deleting.name} will be removed from your workspace. Documents created from it are untouched.`
            : undefined
        }
        confirmLabel="Delete template"
      >
        <p className="text-[12px] leading-5 text-slate">
          Active public links must be revoked before a template can be deleted.
        </p>
      </ConfirmDialog>
    </div>
  );
}
