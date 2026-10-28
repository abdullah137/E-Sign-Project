"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, MoreHorizontal, Trash2, Undo2 } from "lucide-react";
import { apiFetch } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea, Label, FieldError } from "@/components/ui/input";
import type { DocumentStatus } from "@/lib/documents";
import { documentHref } from "./document-table";

export function DocumentRowActions({
  document: doc,
  canManage,
}: {
  document: { id: string; title: string; status: DocumentStatus };
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const submitVoid = async () => {
    if (reason.trim().length < 3) {
      setError("Enter at least a few words explaining why this request is being withdrawn.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/documents/${doc.id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      toast({ title: "Signing request withdrawn", description: "Outstanding signing links have been revoked.", variant: "success" });
      setVoidOpen(false);
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The document could not be voided.");
    } finally {
      setSaving(false);
    }
  };

  const submitDelete = async () => {
    try {
      await apiFetch(`/api/documents/${doc.id}/delete`, { method: "DELETE" });
      toast({ title: "Draft deleted", variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: "Could not delete the draft",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
      throw err;
    }
  };

  const downloadKind = doc.status === "COMPLETED" ? "finalized" : "original";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 w-8 items-center justify-center rounded text-slate transition-colors hover:bg-surface-subtle hover:text-ink"
        aria-label={`Actions for ${doc.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-40 w-52 overflow-hidden rounded-md border border-hairline bg-surface py-1 shadow-float"
        >
          <Link
            href={documentHref(doc)}
            role="menuitem"
            className="flex min-h-[38px] items-center gap-2.5 px-3.5 text-[13px] text-ink-secondary hover:bg-surface-subtle"
            onClick={() => setOpen(false)}
          >
            <Eye className="h-4 w-4" aria-hidden="true" /> {doc.status === "DRAFT" ? "Continue preparing" : "View details"}
          </Link>
          <a
            href={`/api/documents/${doc.id}/download?kind=${downloadKind}&download=1`}
            role="menuitem"
            className="flex min-h-[38px] items-center gap-2.5 px-3.5 text-[13px] text-ink-secondary hover:bg-surface-subtle"
            onClick={() => setOpen(false)}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {doc.status === "COMPLETED" ? "Download signed PDF" : "Download original"}
          </a>
          {canManage && (doc.status === "PENDING" || doc.status === "FINALIZING") ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setVoidOpen(true);
              }}
              className="flex min-h-[38px] w-full items-center gap-2.5 px-3.5 text-left text-[13px] text-danger hover:bg-[#FBEAEA]"
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" /> Void request…
            </button>
          ) : null}
          {doc.status === "DRAFT" ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setDeleteOpen(true);
              }}
              className="flex min-h-[38px] w-full items-center gap-2.5 px-3.5 text-left text-[13px] text-danger hover:bg-[#FBEAEA]"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete draft…
            </button>
          ) : null}
        </div>
      ) : null}

      <Modal
        open={voidOpen}
        onClose={() => (saving ? undefined : setVoidOpen(false))}
        title="Void this signing request?"
        description="Every outstanding signing link will stop working immediately. This action is recorded in the audit trail."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setVoidOpen(false)} disabled={saving}>
              Keep request
            </Button>
            <Button variant="danger" onClick={submitVoid} loading={saving}>
              Void request
            </Button>
          </>
        }
      >
        <Label htmlFor={`void-${doc.id}`} required>
          Reason
        </Label>
        <Textarea
          id={`void-${doc.id}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain why this request is being withdrawn."
          maxLength={500}
          aria-invalid={Boolean(error)}
        />
        <FieldError>{error}</FieldError>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={submitDelete}
        title="Delete this draft?"
        description="The draft, its field layout and the uploaded original will be removed from your workspace."
        confirmLabel="Delete draft"
      >
        <p className="text-[13px] leading-6 text-slate">
          “{doc.title}” has not been sent to recipients. This cannot be undone.
        </p>
      </ConfirmDialog>
    </div>
  );
}
