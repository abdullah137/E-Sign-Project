"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, Pencil, Plus, Trash2, Upload, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormField, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiClientError } from "@/lib/client";
import { formatBytes } from "@/lib/format";
import type { LandlordFileRow, LandlordRow } from "@/lib/tenancy";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
};

type FormState = typeof EMPTY_FORM;

export function LandlordsPanel({
  landlords,
  propertyCounts,
  fileCounts,
}: {
  landlords: LandlordRow[];
  propertyCounts: Record<string, number>;
  fileCounts: Record<string, number>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LandlordRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [documentsFor, setDocumentsFor] = useState<LandlordRow | null>(null);

  const update = (field: keyof FormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const close = () => {
    setOpen(false);
  };

  const startCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setOpen(true);
  };

  const startEdit = (landlord: LandlordRow) => {
    setEditing(landlord);
    setForm({
      name: landlord.name,
      email: landlord.email,
      phone: landlord.phone,
    });
    setError(null);
    setOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      notes: editing?.notes ?? null,
      idType: editing?.id_type ?? null,
      idNumber: editing?.id_number ?? null,
      lawFirmName: editing?.law_firm_name ?? null,
      lawFirmAddress: editing?.law_firm_address ?? null,
      lawFirmPhone: editing?.law_firm_phone ?? null,
      lawFirmEmail: editing?.law_firm_email ?? null,
    };
    try {
      if (editing) {
        await apiFetch(`/api/tenancy/landlords/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<{ landlord: LandlordRow }>("/api/tenancy/landlords", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      toast({
        title: editing ? "Landlord updated" : "Landlord added",
        description: editing ? `${form.name} has been saved.` : `${form.name} can now be linked to properties.`,
      });
      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "The landlord could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (landlord: LandlordRow) => {
    const count = propertyCounts[landlord.id] ?? 0;
    const message =
      count > 0
        ? `${landlord.name} owns ${count} propert${count === 1 ? "y" : "ies"}. Remove or reassign them before deleting the landlord.`
        : `Delete ${landlord.name}? Their ID documents will be removed. This cannot be undone.`;
    if (count > 0) {
      toast({ title: "Landlord not deleted", description: message });
      return;
    }
    if (!window.confirm(message)) return;
    setDeleting(landlord.id);
    try {
      await apiFetch(`/api/tenancy/landlords/${landlord.id}`, { method: "DELETE" });
      toast({ title: "Landlord deleted", description: `${landlord.name} was removed.` });
      router.refresh();
    } catch (err) {
      toast({
        title: "Landlord not deleted",
        description: err instanceof ApiClientError ? err.message : "Please try again.",
      });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button type="button" onClick={startCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add landlord
        </Button>
      </div>

      {landlords.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="h-5 w-5" aria-hidden="true" />}
          title="No landlords yet"
          description="Add the owner of a property before creating a property profile. Landlords do not need an account — they review inquiries from a private link."
          action={
            <Button type="button" onClick={startCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add your first landlord
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-card">
          {landlords.map((landlord) => (
            <li key={landlord.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-ink">{landlord.name}</p>
                <p className="mt-0.5 text-[12.5px] text-slate">
                  {landlord.email}
                  {landlord.phone ? ` · ${landlord.phone}` : ""}
                </p>
                {landlord.id_type || landlord.id_number || fileCounts[landlord.id] ? (
                  <p className="mt-1 text-[12px] text-slate">
                    {[landlord.id_type, landlord.id_number].filter(Boolean).join(" · ") || "ID document"}
                    {fileCounts[landlord.id] ? ` · ${fileCounts[landlord.id]} document(s)` : ""}
                  </p>
                ) : null}
                {landlord.notes ? (
                  <p className="mt-2 max-w-xl text-[12.5px] leading-5 text-slate">{landlord.notes}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-muted px-2.5 py-1 text-[11.5px] font-medium text-ink-secondary">
                  <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {propertyCounts[landlord.id] ?? 0} propert{(propertyCounts[landlord.id] ?? 0) === 1 ? "y" : "ies"}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDocumentsFor(landlord)}>
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Documents
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(landlord)}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  loading={deleting === landlord.id}
                  onClick={() => remove(landlord)}
                  aria-label={`Delete ${landlord.name}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={close}
        title={editing ? "Edit landlord" : "Add landlord"}
        description="Landlords review inquiries from a private, expiring link. No account is needed."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" form="landlord-form" loading={saving}>
              {editing ? "Save changes" : "Add landlord"}
            </Button>
          </div>
        }
      >
        <form id="landlord-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name" htmlFor="landlord-name" required className="sm:col-span-2">
            <Input id="landlord-name" value={form.name} onChange={update("name")} required data-autofocus />
          </FormField>
          <FormField label="Email" htmlFor="landlord-email" required>
            <Input id="landlord-email" type="email" value={form.email} onChange={update("email")} required />
          </FormField>
          <FormField label="Phone" htmlFor="landlord-phone" required>
            <Input id="landlord-phone" value={form.phone} onChange={update("phone")} required />
          </FormField>
          {error ? (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger sm:col-span-2">
              {error}
            </p>
          ) : null}
        </form>
      </Modal>

      <LandlordDocuments
        landlord={documentsFor}
        onClose={() => setDocumentsFor(null)}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}

function LandlordDocuments({
  landlord,
  onClose,
  onChanged,
}: {
  landlord: LandlordRow | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [files, setFiles] = useState<LandlordFileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!landlord) {
      setFiles([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<{ files: LandlordFileRow[] }>(`/api/tenancy/landlords/${landlord.id}/files`)
      .then((result) => {
        if (!cancelled) setFiles(result.files);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiClientError ? err.message : "Documents could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [landlord]);

  const upload = async (file: File | null) => {
    if (!landlord || !file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const result = await apiFetch<{ file: LandlordFileRow }>(`/api/tenancy/landlords/${landlord.id}/files`, {
        method: "POST",
        body,
      });
      setFiles((current) => [...current, result.file]);
      toast({ title: "Document uploaded", description: file.name });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "The document could not be uploaded.");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (file: LandlordFileRow) => {
    if (!landlord || !window.confirm(`Delete ${file.original_filename}?`)) return;
    try {
      await apiFetch(`/api/tenancy/landlords/${landlord.id}/files/${file.id}`, { method: "DELETE" });
      setFiles((current) => current.filter((item) => item.id !== file.id));
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "The document could not be deleted.");
    }
  };

  return (
    <Modal
      open={Boolean(landlord)}
      onClose={onClose}
      title={landlord ? `Documents · ${landlord.name}` : "Documents"}
      description="Identity documents are stored privately and only available to this workspace."
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <label className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-pill bg-brand-600 px-6 text-sm font-medium text-white hover:bg-brand-700 ${uploading ? "opacity-60" : ""}`}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            {uploading ? "Uploading…" : "Upload document"}
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                void upload(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      }
    >
      {error ? (
        <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-[13px] text-slate">Loading documents…</p>
      ) : files.length === 0 ? (
        <p className="text-[13px] text-slate">No ID documents uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 rounded-lg border border-hairline bg-card px-4 py-3">
              <FileText className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              <a
                href={`/api/tenancy/landlords/${landlord?.id}/files/${file.id}`}
                className="min-w-0 flex-1 truncate text-[13px] text-ink hover:underline"
              >
                {file.original_filename}
              </a>
              <span className="text-[11.5px] text-slate">{formatBytes(file.bytes)}</span>
              <button
                type="button"
                onClick={() => remove(file)}
                className="text-slate hover:text-danger"
                aria-label={`Delete ${file.original_filename}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
