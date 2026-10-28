"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Lock,
  PenLine,
  ShieldCheck,
  X,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Checkbox, FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PdfViewer } from "@/components/pdf/pdf-viewer";
import { SignatureDialog } from "@/components/signing/signature-dialog";
import { apiFetch } from "@/lib/client";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { FIELD_DEFINITIONS, isValidEmail, type FieldType } from "@/lib/field-types";

export interface SigningField {
  id: string;
  pageIndex: number;
  type: FieldType;
  label: string | null;
  required: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SigningValue {
  fieldId: string;
  valueText: string | null;
  checked: boolean;
  signatureAssetId: string | null;
  signatureMode: string | null;
}

export interface SigningExperienceProps {
  token: string;
  documentTitle: string;
  senderName: string;
  workspaceName: string;
  workspaceColor?: string | null;
  recipientName: string;
  recipientEmail: string;
  message: string | null;
  status: string;
  viewState: "signing" | "finalizing" | "completed";
  signedAt: string | null;
  expiresAt: string | null;
  fields: SigningField[];
  values: SigningValue[];
}

type Phase = "consent" | "signing" | "signed" | "finalizing" | "completed" | "declined";

interface LocalValue {
  valueText: string;
  checked: boolean;
  signatureAssetId: string | null;
  signatureMode: string | null;
}

function fieldComplete(field: SigningField, value: LocalValue | undefined): boolean {
  if (!value) return false;
  if (field.type === "signature" || field.type === "initials") return Boolean(value.signatureAssetId);
  if (field.type === "checkbox") return value.checked;
  const text = value.valueText.trim();
  if (!text) return false;
  if (field.type === "email") return isValidEmail(text);
  return true;
}

export function SigningExperience(props: SigningExperienceProps) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>(() => {
    if (props.viewState === "completed") return "completed";
    if (props.viewState === "finalizing") return "finalizing";
    if (props.status === "SIGNED") return "signed";
    if (props.status === "CONSENTED") return "signing";
    return "consent";
  });
  const [values, setValues] = useState<Record<string, LocalValue>>(() => {
    const initial: Record<string, LocalValue> = {};
    for (const field of props.fields) {
      const saved = props.values.find((value) => value.fieldId === field.id);
      initial[field.id] = {
        valueText:
          saved?.valueText ??
          (field.type === "name"
            ? props.recipientName
            : field.type === "email"
              ? props.recipientEmail
              : ""),
        checked: saved?.checked ?? false,
        signatureAssetId: saved?.signatureAssetId ?? null,
        signatureMode: saved?.signatureMode ?? null,
      };
    }
    return initial;
  });
  const [pageWidth, setPageWidth] = useState(680);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);
  const [signatureTarget, setSignatureTarget] = useState<SigningField | null>(null);
  const [signatureSaving, setSignatureSaving] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineSaving, setDeclineSaving] = useState(false);
  const [declineError, setDeclineError] = useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef<Record<string, string>>({});
  const openedRef = useRef(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setPageWidth(Math.min(820, Math.max(300, width - 32)));
    });
    observer.observe(element);
    setPageWidth(Math.min(820, Math.max(300, element.clientWidth - 32)));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    void apiFetch(`/api/sign/${props.token}/open`, { method: "POST" }).catch(() => undefined);
  }, [props.token]);

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const field of props.fields) {
      const saved = props.values.find((value) => value.fieldId === field.id);
      initial[field.id] = JSON.stringify({
        text: saved?.valueText ?? "",
        checked: saved?.checked ?? false,
        asset: saved?.signatureAssetId ?? null,
      });
    }
    savedRef.current = initial;
  }, [props.fields, props.values]);

  const required = useMemo(() => props.fields.filter((field) => field.required), [props.fields]);
  const completed = required.filter((field) => fieldComplete(field, values[field.id])).length;

  const saveField = useCallback(
    async (field: SigningField, submission: Record<string, unknown>) => {
      setSavingFieldId(field.id);
      try {
        const result = await apiFetch<{
          progress: { required: number; completed: number };
          value: {
            valueText: string | null;
            checked: boolean;
            signatureAssetId: string | null;
            signatureMode: string | null;
          };
        }>(`/api/sign/${props.token}/fields/${field.id}`, {
          method: "POST",
          body: JSON.stringify(submission),
        });
        setValues((current) => ({
          ...current,
          [field.id]: {
            valueText: result.value.valueText ?? "",
            checked: result.value.checked,
            signatureAssetId: result.value.signatureAssetId,
            signatureMode: result.value.signatureMode,
          },
        }));
        savedRef.current[field.id] = JSON.stringify({
          text: result.value.valueText ?? "",
          checked: result.value.checked,
          asset: result.value.signatureAssetId,
        });
      } catch (error) {
        toast({
          title: "This field was not saved",
          description: error instanceof Error ? error.message : undefined,
          variant: "error",
        });
        throw error;
      } finally {
        setSavingFieldId(null);
      }
    },
    [props.token, toast],
  );

  const commitText = async (field: SigningField) => {
    const value = values[field.id];
    if (!value) return;
    const serialized = JSON.stringify({
      text: value.valueText,
      checked: value.checked,
      asset: value.signatureAssetId,
    });
    if (serialized === savedRef.current[field.id]) return;
    try {
      await saveField(field, { valueText: value.valueText });
    } catch {
      // The toast explains the failure; the value remains editable.
    }
  };

  const toggleCheckbox = async (field: SigningField, checked: boolean) => {
    setValues((current) => ({
      ...current,
      [field.id]: { ...current[field.id], checked },
    }));
    try {
      await saveField(field, { checked });
    } catch {
      setValues((current) => ({
        ...current,
        [field.id]: { ...current[field.id], checked: !checked },
      }));
    }
  };

  const adoptSignature = async (dataUrl: string, mode: "type" | "draw" | "upload") => {
    if (!signatureTarget) return;
    setSignatureSaving(true);
    try {
      const asset = await apiFetch<{ assetId: string }>(`/api/sign/${props.token}/signature`, {
        method: "POST",
        body: JSON.stringify({ dataUrl, mode }),
      });
      await saveField(signatureTarget, {
        signatureAssetId: asset.assetId,
        signatureMode: mode,
      });
      setSignatureTarget(null);
      toast({ title: "Signature added", variant: "success" });
    } finally {
      setSignatureSaving(false);
    }
  };

  const acceptConsent = async () => {
    if (!consentChecked) {
      setConsentError("Confirm that you agree before continuing.");
      return;
    }
    setConsentSaving(true);
    setConsentError(null);
    try {
      await apiFetch(`/api/sign/${props.token}/consent`, {
        method: "POST",
        body: JSON.stringify({ accepted: true }),
      });
      setPhase("signing");
      toast({
        title: "Consent recorded",
        description: "Your fields are now available to complete.",
        variant: "success",
      });
    } catch (error) {
      setConsentError(error instanceof Error ? error.message : "Consent could not be recorded.");
    } finally {
      setConsentSaving(false);
    }
  };

  const decline = async () => {
    setDeclineSaving(true);
    setDeclineError(null);
    try {
      await apiFetch(`/api/sign/${props.token}/decline`, {
        method: "POST",
        body: JSON.stringify({ reason: declineReason.trim() || null }),
      });
      setDeclineOpen(false);
      setPhase("declined");
    } catch (error) {
      setDeclineError(error instanceof Error ? error.message : "The request could not be declined.");
    } finally {
      setDeclineSaving(false);
    }
  };

  const finishSigning = async () => {
    setCompleting(true);
    setCompleteError(null);
    try {
      for (const field of props.fields) {
        if (field.type === "signature" || field.type === "initials" || field.type === "checkbox") continue;
        const value = values[field.id];
        if (!value) continue;
        const serialized = JSON.stringify({
          text: value.valueText,
          checked: value.checked,
          asset: value.signatureAssetId,
        });
        if (serialized === savedRef.current[field.id]) continue;
        await saveField(field, { valueText: value.valueText });
      }
      const result = await apiFetch<{
        documentCompleted: boolean;
        finalizationPending: boolean;
        finalizationError?: string;
      }>(`/api/sign/${props.token}/complete`, { method: "POST" });
      setCompleteOpen(false);
      if (result.documentCompleted) setPhase("completed");
      else if (result.finalizationPending) {
        setPhase("finalizing");
      } else setPhase("signed");
    } catch (error) {
      setCompleteError(error instanceof Error ? error.message : "Signing could not be completed.");
    } finally {
      setCompleting(false);
    }
  };

  const goToNextRequired = () => {
    const next = required.find((field) => !fieldComplete(field, values[field.id]));
    if (!next) {
      setCompleteOpen(true);
      return;
    }
    setHighlighted(next.id);
    const element = document.getElementById(`sign-field-${next.id}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setHighlighted(null), 2200);
  };

  const brandBar = (
    <header className="sticky top-0 z-30 border-b border-hairline bg-[rgba(248,249,250,0.94)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Logo href="/" compact />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{props.documentTitle}</p>
          <p className="truncate text-[11px] text-slate">
            {props.workspaceColor ? (
              <span
                className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                style={{ backgroundColor: props.workspaceColor }}
                aria-hidden="true"
              />
            ) : null}
            {props.workspaceName} · Secure signing link
          </p>
        </div>
        {phase === "signing" || phase === "consent" ? (
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-gold transition-[width] duration-200"
                style={{ width: `${required.length ? (completed / required.length) * 100 : 0}%` }}
              />
            </div>
            <span className="tabular text-[11.5px] text-slate">
              {completed} of {required.length} required fields
            </span>
          </div>
        ) : null}
        <a
          href={`/api/sign/${props.token}/file`}
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1.5 text-[11.5px] font-medium text-slate hover:text-ink sm:flex"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          Original PDF
        </a>
      </div>
    </header>
  );

  if (phase === "declined") {
    return (
      <div className="min-h-screen bg-bg">
        {brandBar}
        <main className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FBEAEA] text-danger">
            <X className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-serif text-[32px] leading-10 text-ink">You declined to sign</h1>
          <p className="mt-2 text-[13.5px] leading-6 text-slate">
            {props.senderName} has been notified and all signing links for this request are now inactive.
            You can close this page.
          </p>
          <p className="mt-6 text-[11px] text-placeholder">
            Reference {props.token.slice(0, 8)}… · {formatDateTime(new Date().toISOString())}
          </p>
        </main>
      </div>
    );
  }

  if (phase === "completed" || phase === "finalizing" || phase === "signed") {
    const completedNow = phase === "completed" || props.viewState === "completed";
    const waitingForOthers = phase === "signed" && !completedNow;
    return (
      <div className="min-h-screen bg-bg">
        {brandBar}
        <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="rounded-card border border-hairline bg-surface p-7 text-center sm:p-10">
            <span
              className={cn(
                "mx-auto flex h-12 w-12 items-center justify-center rounded-full",
                waitingForOthers ? "bg-warning-bg text-gold-text" : "bg-success-bg text-success-text",
              )}
            >
              {waitingForOthers ? (
                <Clock3 className="h-6 w-6" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              )}
            </span>
            <h1 className="mt-5 font-serif text-[32px] leading-10 text-ink">
              {waitingForOthers
                ? "Your signature is recorded"
                : phase === "finalizing"
                  ? "Every signature is in"
                  : "Signing complete"}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-6 text-slate">
              {waitingForOthers
                ? `Thank you, ${props.recipientName}. The other recipients still need to sign. You can return to this link at any time to check the status.`
                : phase === "finalizing"
                  ? "All required signatures are recorded. SignFlow is generating the completed PDF — this usually takes a few seconds."
                  : `“${props.documentTitle}” is complete. A copy is available to download, and the sender has been notified.`}
            </p>

            <dl className="mx-auto mt-6 max-w-sm space-y-2 border-t border-hairline pt-4 text-left text-[12px]">
              <div className="flex items-center justify-between">
                <dt className="text-slate">Signed by</dt>
                <dd className="font-semibold text-ink">{props.recipientName}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate">Signed at</dt>
                <dd className="text-ink-secondary">
                  {formatDateTime(props.signedAt ?? new Date().toISOString())}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate">Consent version</dt>
                <dd className="text-ink-secondary">esign-consent-1.0</dd>
              </div>
            </dl>

            {phase === "completed" || completedNow ? (
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href={`/api/sign/${props.token}/download`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded border border-transparent bg-ink px-6 text-sm font-medium text-white hover:bg-[#24282F]"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download signed PDF
                </a>
                <a
                  href={`/api/sign/${props.token}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded border border-[rgba(18,20,23,0.12)] px-6 text-sm font-medium text-ink hover:bg-surface-subtle"
                >
                  View original
                </a>
              </div>
            ) : null}

            <p className="mt-6 flex items-start justify-center gap-1.5 text-[10.5px] leading-4 text-slate">
              <ShieldCheck className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
              Your signature, consent and timestamp are recorded in the document audit trail. This is an
              evidentiary record, not a legal opinion.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (phase === "consent") {
    return (
      <div className="min-h-screen bg-bg">
        {brandBar}
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="rounded-card border border-hairline bg-surface">
            <div className="border-b border-hairline px-5 py-6 sm:px-8">
              <p className="overline">Electronic signature request</p>
              <h1 className="mt-2 font-serif text-[30px] leading-9 text-ink sm:text-[36px] sm:leading-[44px]">
                {props.documentTitle}
              </h1>
              <p className="mt-2 text-[13px] text-slate">
                Sent by <span className="font-medium text-ink-secondary">{props.senderName}</span> ·{" "}
                {props.workspaceName}
              </p>
            </div>

            <div className="grid gap-6 px-5 py-6 sm:grid-cols-[minmax(0,1fr)_220px] sm:px-8">
              <div className="space-y-5">
                <div>
                  <p className="overline mb-2">Prepared for</p>
                  <p className="text-[14px] font-semibold text-ink">{props.recipientName}</p>
                  <p className="text-[12.5px] text-slate">{props.recipientEmail}</p>
                </div>

                {props.message ? (
                  <div className="rounded border border-hairline bg-surface-subtle/60 px-4 py-3">
                    <p className="text-[10.5px] font-semibold uppercase tracking-overline text-slate">
                      Message from the sender
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-6 text-ink-secondary">
                      {props.message}
                    </p>
                  </div>
                ) : null}

                <div className="rounded-md border border-hairline p-4">
                  <p className="text-[12.5px] font-semibold text-ink">Consent to electronic signatures</p>
                  <p className="mt-1.5 text-[12px] leading-5 text-slate">
                    By continuing, you agree to sign this document electronically and to receive related
                    records electronically. You can review the original PDF before accepting. Your consent,
                    signature and timestamp will be recorded in the document audit trail.
                  </p>
                  <div className="mt-3">
                    <Checkbox
                      id="consent"
                      checked={consentChecked}
                      onChange={(event) => {
                        setConsentChecked(event.target.checked);
                        if (event.target.checked) setConsentError(null);
                      }}
                      label={
                        <span className="text-[12.5px]">
                          I agree to conduct this transaction electronically and confirm I am{" "}
                          {props.recipientName}.
                        </span>
                      }
                    />
                  </div>
                  <FieldError>{consentError}</FieldError>
                </div>
              </div>

              <aside className="space-y-3 border-t border-hairline pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-overline text-slate">
                    Your fields
                  </p>
                  <p className="tabular mt-1 text-[22px] font-serif text-ink">{required.length}</p>
                  <p className="text-[11.5px] text-slate">required to complete</p>
                </div>
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-overline text-slate">
                    Expires
                  </p>
                  <p className="mt-1 text-[12px] text-ink-secondary">{formatDate(props.expiresAt)}</p>
                </div>
                <a
                  href={`/api/sign/${props.token}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gold-text hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  Review original PDF
                </a>
              </aside>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-hairline bg-surface-subtle/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <button
                type="button"
                onClick={() => setDeclineOpen(true)}
                className="text-left text-[12.5px] font-medium text-slate underline-offset-2 hover:text-danger hover:underline"
              >
                Decline to sign
              </button>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <a
                  href={`/api/sign/${props.token}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center rounded border border-[rgba(18,20,23,0.12)] px-5 text-sm font-medium text-ink hover:bg-surface"
                >
                  View document
                </a>
                <Button onClick={acceptConsent} loading={consentSaving} disabled={!consentChecked}>
                  Accept and continue
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>

          <p className="mx-auto mt-5 flex max-w-lg items-start justify-center gap-1.5 text-center text-[10.5px] leading-4 text-slate">
            <Lock className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
            This is a private, single-recipient link. Do not forward it. Contact {props.senderName} if you
            were not expecting this document.
          </p>
        </main>

        <DeclineDialog
          open={declineOpen}
          onClose={() => (declineSaving ? undefined : setDeclineOpen(false))}
          reason={declineReason}
          setReason={setDeclineReason}
          error={declineError}
          saving={declineSaving}
          onConfirm={decline}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      {brandBar}
      <main ref={containerRef} className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl pb-4 text-center">
          <p className="text-[12px] text-slate">
            Review the document and complete the highlighted fields assigned to you.
          </p>
        </div>
        <PdfViewer
          url={`/api/sign/${props.token}/file`}
          width={pageWidth}
          renderPageOverlay={(pageIndex) => (
            <div className="absolute inset-0">
              {props.fields
                .filter((field) => field.pageIndex === pageIndex)
                .map((field) => (
                  <SigningFieldBox
                    key={field.id}
                    token={props.token}
                    field={field}
                    value={values[field.id]}
                    highlighted={highlighted === field.id}
                    saving={savingFieldId === field.id}
                    onChange={(valueText) =>
                      setValues((current) => ({
                        ...current,
                        [field.id]: { ...current[field.id], valueText },
                      }))
                    }
                    onBlur={() => commitText(field)}
                    onToggle={(checked) => toggleCheckbox(field, checked)}
                    onOpenSignature={() => setSignatureTarget(field)}
                  />
                ))}
            </div>
          )}
        />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface/97 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-gold transition-[width] duration-200"
                style={{ width: `${required.length ? (completed / required.length) * 100 : 0}%` }}
              />
            </div>
            <div>
              <p className="tabular text-[12px] font-semibold text-ink">
                {completed} of {required.length} required fields
              </p>
              <p className="text-[10.5px] text-slate">
                {completed === required.length
                  ? "All required fields are complete"
                  : "Complete each field to finish signing"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDeclineOpen(true)}
              className="hidden text-[12px] font-medium text-slate hover:text-danger sm:inline"
            >
              Decline
            </button>
            <Button variant="secondary" size="sm" onClick={goToNextRequired}>
              {completed === required.length ? "Review fields" : "Next required field"}
            </Button>
            <Button
              size="md"
              onClick={() => setCompleteOpen(true)}
              disabled={completed < required.length}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Complete signing
            </Button>
          </div>
        </div>
      </div>

      <SignatureDialog
        open={Boolean(signatureTarget)}
        onClose={() => setSignatureTarget(null)}
        onAdopt={adoptSignature}
        suggestedName={props.recipientName}
        fieldLabel={signatureTarget ? FIELD_DEFINITIONS[signatureTarget.type].label : "Signature"}
        saving={signatureSaving}
      />

      <Modal
        open={completeOpen}
        onClose={() => (completing ? undefined : setCompleteOpen(false))}
        title="Complete signing?"
        description="Once submitted, your signature is recorded and may not be changed."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompleteOpen(false)} disabled={completing}>
              Keep editing
            </Button>
            <Button onClick={finishSigning} loading={completing}>
              Sign and complete
            </Button>
          </>
        }
      >
        <dl className="space-y-2 text-[12.5px]">
          <div className="flex items-center justify-between">
            <dt className="text-slate">Document</dt>
            <dd className="max-w-[65%] truncate text-right font-medium text-ink">{props.documentTitle}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate">Signer</dt>
            <dd className="text-right font-medium text-ink">{props.recipientName}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate">Required fields</dt>
            <dd className="tabular text-right font-medium text-success-text">
              {completed} of {required.length} complete
            </dd>
          </div>
        </dl>
        <p className="mt-3 rounded bg-surface-subtle px-3 py-2.5 text-[11.5px] leading-5 text-slate">
          Your consent to electronic signing, timestamp and the final document content are recorded in the
          audit trail. If other recipients are still signing, you will see their status when you reopen this
          link.
        </p>
        <FieldError>{completeError}</FieldError>
      </Modal>

      <DeclineDialog
        open={declineOpen}
        onClose={() => (declineSaving ? undefined : setDeclineOpen(false))}
        reason={declineReason}
        setReason={setDeclineReason}
        error={declineError}
        saving={declineSaving}
        onConfirm={decline}
      />
    </div>
  );
}

function SigningFieldBox({
  token,
  field,
  value,
  highlighted,
  saving,
  onChange,
  onBlur,
  onToggle,
  onOpenSignature,
}: {
  token: string;
  field: SigningField;
  value: LocalValue | undefined;
  highlighted: boolean;
  saving: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
  onToggle: (checked: boolean) => void;
  onOpenSignature: () => void;
}) {
  const complete = fieldComplete(field, value);
  const definition = FIELD_DEFINITIONS[field.type];

  return (
    <div
      id={`sign-field-${field.id}`}
      className={cn(
        "absolute rounded-sm transition-shadow",
        highlighted && "ring-2 ring-gold ring-offset-2 ring-offset-white",
      )}
      style={{
        left: `${field.x * 100}%`,
        top: `${field.y * 100}%`,
        width: `${field.width * 100}%`,
        height: `${field.height * 100}%`,
      }}
    >
      <span className="pointer-events-none absolute -top-[15px] left-0 z-[1] max-w-full truncate text-[9px] font-semibold uppercase tracking-wide text-gold-text">
        {field.label || definition.label}
        {field.required ? " *" : ""}
      </span>
      {field.type === "signature" || field.type === "initials" ? (
        <button
          type="button"
          onClick={onOpenSignature}
          className={cn(
            "flex h-full w-full items-center justify-center gap-1.5 overflow-hidden rounded-sm border px-1 text-[10px] font-medium",
            complete
              ? "border-[rgba(40,93,57,0.4)] bg-success-bg/40"
              : "border-gold bg-warning-bg/40 text-gold-text hover:bg-warning-bg/70",
          )}
          aria-label={`${complete ? "Replace" : "Add"} ${definition.label.toLowerCase()} for ${field.label || definition.label}`}
        >
          {value?.signatureAssetId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/sign/${token}/asset/${value.signatureAssetId}`}
              alt={`${definition.label} applied`}
              className="h-full w-full object-contain p-0.5"
            />
          ) : (
            <>
              <PenLine className="h-3 w-3" aria-hidden="true" />
              {field.width > 0.1 ? <span>Sign here</span> : null}
            </>
          )}
          {saving ? (
            <span className="absolute inset-0 flex items-center justify-center bg-surface/70 text-[9px] text-slate">
              Saving…
            </span>
          ) : null}
        </button>
      ) : field.type === "checkbox" ? (
        <button
          type="button"
          onClick={() => onToggle(!value?.checked)}
          className={cn(
            "flex h-full w-full items-center justify-center rounded-sm border",
            value?.checked
              ? "border-[rgba(40,93,57,0.45)] bg-success-bg text-success-text"
              : "border-gold bg-warning-bg/30 hover:bg-warning-bg/60",
          )}
          aria-pressed={Boolean(value?.checked)}
          aria-label={`${field.label || "Checkbox"}${field.required ? ", required" : ""}`}
        >
          {value?.checked ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" /> : null}
        </button>
      ) : (
        <div
          className={cn(
            "h-full w-full overflow-hidden rounded-sm border bg-white/80",
            complete ? "border-[rgba(40,93,57,0.35)]" : "border-gold",
          )}
        >
          {field.type === "address" ? (
            <textarea
              value={value?.valueText ?? ""}
              onChange={(event) => onChange(event.target.value)}
              onBlur={onBlur}
              aria-label={`${field.label || definition.label}${field.required ? ", required" : ""}`}
              placeholder={definition.label}
              className="h-full w-full resize-none border-0 bg-transparent px-1.5 py-1 text-[11px] leading-[1.2] text-ink placeholder:text-placeholder focus:outline-none"
              maxLength={500}
            />
          ) : (
            <input
              type={field.type === "date" ? "date" : field.type === "email" ? "email" : "text"}
              value={value?.valueText ?? ""}
              onChange={(event) => onChange(event.target.value)}
              onBlur={onBlur}
              aria-label={`${field.label || definition.label}${field.required ? ", required" : ""}`}
              placeholder={definition.label}
              className="h-full w-full border-0 bg-transparent px-1.5 text-[11px] text-ink placeholder:text-placeholder focus:outline-none"
              maxLength={200}
            />
          )}
        </div>
      )}
    </div>
  );
}

function DeclineDialog({
  open,
  onClose,
  reason,
  setReason,
  error,
  saving,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  reason: string;
  setReason: (value: string) => void;
  error: string | null;
  saving: boolean;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Decline to sign?"
      description="The sender will be notified and every signing link for this request will stop working."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Keep reviewing
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={saving}>
            Decline to sign
          </Button>
        </>
      }
    >
      <Label htmlFor="decline-reason">Reason (optional)</Label>
      <Textarea
        id="decline-reason"
        value={reason}
        maxLength={500}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Let the sender know why you are unable to sign."
      />
      <FieldError>{error}</FieldError>
    </Modal>
  );
}
