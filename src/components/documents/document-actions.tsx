"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, RefreshCw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Label, Textarea, FieldError } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import type { DocumentStatus } from "@/lib/documents";

export function RemindButton({
  documentId,
  recipientId,
  recipientName,
  showDevOutbox,
}: {
  documentId: string;
  recipientId: string;
  recipientName: string;
  showDevOutbox: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const remind = async () => {
    setLoading(true);
    try {
      await apiFetch(`/api/documents/${documentId}/remind`, {
        method: "POST",
        body: JSON.stringify({ recipientId }),
      });
      toast({
        title: "Reminder queued",
        description: showDevOutbox
          ? `A fresh signing link was generated for ${recipientName}. Open the dev outbox to view it.`
          : `A new signing link was emailed to ${recipientName}.`,
        variant: "success",
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "Reminder not sent",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="secondary" size="sm" onClick={remind} loading={loading}>
      <Bell className="h-3.5 w-3.5" aria-hidden="true" />
      Remind
    </Button>
  );
}

export function DocumentActions({
  documentId,
  status,
  canManage,
}: {
  documentId: string;
  status: DocumentStatus;
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const submitVoid = async () => {
    if (reason.trim().length < 3) {
      setError("Enter a reason for withdrawing this request.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/documents/${documentId}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      toast({
        title: "Signing request withdrawn",
        description: "All outstanding signing links are now inactive.",
        variant: "success",
      });
      setVoidOpen(false);
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The document could not be voided.");
    } finally {
      setSaving(false);
    }
  };

  const retryFinalization = async () => {
    setRetrying(true);
    try {
      await apiFetch(`/api/documents/${documentId}/finalize`, { method: "POST" });
      toast({ title: "Finalization complete", variant: "success" });
      router.refresh();
    } catch (error) {
      toast({
        title: "Finalization failed again",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setRetrying(false);
    }
  };

  if (status === "FINALIZING") {
    return (
      <Button variant="secondary" size="sm" onClick={retryFinalization} loading={retrying}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Retry finalization
      </Button>
    );
  }

  if (!canManage || status !== "PENDING") return null;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setVoidOpen(true)}>
        <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
        Void request
      </Button>
      <Modal
        open={voidOpen}
        onClose={() => (saving ? undefined : setVoidOpen(false))}
        title="Void this signing request?"
        description="Outstanding signing links will stop working immediately. This is recorded in the audit trail."
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
        <Label htmlFor="detail-void-reason" required>
          Reason
        </Label>
        <Textarea
          id="detail-void-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          placeholder="Explain why this request is being withdrawn."
          aria-invalid={Boolean(error)}
        />
        <FieldError>{error}</FieldError>
      </Modal>
    </>
  );
}
