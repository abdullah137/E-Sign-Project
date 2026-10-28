"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Link2,
  Lock,
  Mail,
  Send,
  Users,
} from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Label, Textarea, Select, FieldError } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { SendValidationIssue } from "@/lib/documents";

export interface SendRecipient {
  id: string;
  name: string;
  email: string;
  fieldCount: number;
}

interface SendResult {
  expiresAt: string;
  recipientCount: number;
  demoLinks: Array<{ email: string; link: string }>;
}

export function SendReview({
  documentId,
  title,
  fileName,
  pageCount,
  recipients,
  fields,
  issues,
  initialMessage,
  defaultExpiryDays,
  senderName,
  workspaceName,
  documentSha256,
}: {
  documentId: string;
  title: string;
  fileName: string;
  pageCount: number;
  recipients: SendRecipient[];
  fields: number;
  issues: SendValidationIssue[];
  initialMessage: string | null;
  defaultExpiryDays: number;
  senderName: string;
  workspaceName: string;
  documentSha256: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage ?? "");
  const [expiry, setExpiry] = useState(String(defaultExpiryDays));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

  const blocking = issues.length > 0;

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const response = await apiFetch<SendResult>(`/api/documents/${documentId}/send`, {
        method: "POST",
        body: JSON.stringify({
          message: message.trim() ? message.trim() : null,
          expiresInDays: Number(expiry),
        }),
      });
      setResult(response);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The invitations could not be sent.");
    } finally {
      setSending(false);
    }
  };

  if (result) {
    return (
      <div className="mx-auto max-w-2xl py-4">
        <div className="rounded-card border border-hairline bg-surface p-7 text-center sm:p-10">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-success-text">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-5 font-serif text-[30px] leading-9 text-ink">Document sent</h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-6 text-slate">
            Invitations were queued for {result.recipientCount} recipient
            {result.recipientCount === 1 ? "" : "s"}. Each link is unique and expires on{" "}
            {formatDate(result.expiresAt)}.
          </p>

          {result.demoLinks.length > 0 ? (
            <div className="mt-6 rounded-md border border-dashed border-hairline-strong bg-surface-subtle/60 p-4 text-left">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-overline text-slate">
                <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                Demo mode — signing links
              </p>
              <p className="mt-1 text-[11.5px] leading-5 text-slate">
                Email delivery is in development mode. Use these links to sign as each recipient.
              </p>
              <ul className="mt-3 space-y-2">
                {result.demoLinks.map((link) => (
                  <li key={link.email} className="flex flex-col gap-1 rounded border border-hairline bg-surface px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="truncate text-[12px] text-ink-secondary">{link.email}</span>
                    <a
                      href={link.link}
                      className="shrink-0 text-[12px] font-semibold text-gold-text hover:underline"
                    >
                      Open signing page
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={`/app/documents/${documentId}`} className={buttonStyles("primary", "md")}>
              View document
            </Link>
            <Link href="/app/documents" className={buttonStyles("secondary", "md")}>
              All documents
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <section className="rounded-card border border-hairline bg-surface p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-hairline bg-surface-subtle text-slate">
              <FileText className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-ink">{title}</p>
              <p className="mt-0.5 text-[12px] text-slate">
                {fileName} · {pageCount} page{pageCount === 1 ? "" : "s"} · {fields} field
                {fields === 1 ? "" : "s"}
              </p>
              <p className="mt-1 break-all font-mono text-[10.5px] text-placeholder">
                SHA-256 {documentSha256}
              </p>
            </div>
            <Link
              href={`/app/documents/${documentId}/prepare`}
              className="shrink-0 text-[12px] font-semibold text-gold-text hover:underline"
            >
              Edit fields
            </Link>
          </div>
        </section>

        <section className="rounded-card border border-hairline bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-[22px] leading-7 text-ink">Recipients</h2>
            <span className="flex items-center gap-1.5 text-[12px] text-slate">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {recipients.length}
            </span>
          </div>
          <ul className="mt-4 divide-y divide-hairline">
            {recipients.map((recipient, index) => {
              const recipientIssues = issues.filter(
                (issue) => issue.scope === "recipient" && issue.recipientId === recipient.id,
              );
              return (
                <li key={recipient.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="tabular mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hairline text-[10.5px] font-semibold text-gold-text">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-ink">
                      {recipient.name || "Unnamed recipient"}
                    </p>
                    <p className="truncate text-[12px] text-slate">{recipient.email || "No email"}</p>
                    {recipientIssues.map((issue) => (
                      <p key={issue.message} className="mt-1 flex items-center gap-1 text-[11.5px] text-danger">
                        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {issue.message}
                      </p>
                    ))}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-pill px-2 py-0.5 text-[10.5px] font-semibold",
                      recipient.fieldCount > 0
                        ? "bg-success-bg text-success-text"
                        : "bg-[#FBEAEA] text-danger",
                    )}
                  >
                    {recipient.fieldCount} field{recipient.fieldCount === 1 ? "" : "s"}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-slate">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            Signing is parallel in this version. Every recipient can sign as soon as invitations are sent.
          </p>
        </section>

        <section className="rounded-card border border-hairline bg-surface p-5 sm:p-6">
          <h2 className="font-serif text-[22px] leading-7 text-ink">Invitation message</h2>
          <p className="mt-1 text-[12px] text-slate">
            Included in each email above the secure signing button. Keep it short and specific.
          </p>
          <div className="mt-4">
            <Label htmlFor="send-message">Message</Label>
            <Textarea
              id="send-message"
              value={message}
              maxLength={2000}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={`${senderName} has requested your signature on “${title}”.`}
            />
            <p className="mt-1.5 text-right text-[11px] tabular text-slate">{message.length} / 2000</p>
          </div>
        </section>

        <section className="rounded-card border border-hairline bg-surface p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-serif text-[22px] leading-7 text-ink">Expiry</h2>
              <p className="mt-1 text-[12px] text-slate">
                Outstanding links stop working after this window.
              </p>
            </div>
            <div className="w-full sm:w-52">
              <Label htmlFor="send-expiry" className="sr-only">
                Signing link expiry
              </Label>
              <Select
                id="send-expiry"
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
              >
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </Select>
            </div>
          </div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-card border border-hairline bg-surface p-5">
          <p className="overline">Send review</p>
          {blocking ? (
            <div className="mt-3 rounded border border-[rgba(186,26,26,0.2)] bg-[#FBEAEA] px-3 py-2.5">
              <p className="text-[12px] font-semibold text-danger">
                {issues.length} issue{issues.length === 1 ? "" : "s"} to resolve
              </p>
              <ul className="mt-1.5 space-y-1">
                {issues.slice(0, 5).map((issue) => (
                  <li key={`${issue.scope}-${issue.message}`} className="flex items-start gap-1.5 text-[11.5px] leading-5 text-danger">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                    {issue.message}
                  </li>
                ))}
                {issues.length > 5 ? (
                  <li className="text-[11.5px] text-danger">…and {issues.length - 5} more.</li>
                ) : null}
              </ul>
              <Link
                href={`/app/documents/${documentId}/prepare`}
                className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-danger underline-offset-2 hover:underline"
              >
                <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                Return to prepare
              </Link>
            </div>
          ) : (
            <p className="mt-2 flex items-start gap-2 text-[12.5px] leading-5 text-success-text">
              <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Every recipient has at least one field and the layout is valid.
            </p>
          )}

          <dl className="mt-4 space-y-2 border-t border-hairline pt-3 text-[12px]">
            <div className="flex items-center justify-between">
              <dt className="text-slate">Recipients</dt>
              <dd className="tabular font-semibold text-ink">{recipients.length}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate">Fields</dt>
              <dd className="tabular font-semibold text-ink">{fields}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate">Signing order</dt>
              <dd className="font-medium text-ink">Parallel</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate">Expires</dt>
              <dd className="font-medium text-ink">{expiry} days</dd>
            </div>
          </dl>

          {error ? <FieldError>{error}</FieldError> : null}

          <Button
            className="mt-4 w-full"
            onClick={send}
            loading={sending}
            disabled={blocking}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Send invitations
          </Button>
          <Link
            href={`/app/documents/${documentId}/prepare`}
            className={buttonStyles("secondary", "md", "mt-2 w-full")}
          >
            Back to editing
          </Link>

          <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-4 text-slate">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            Recipients must accept electronic signing consent before their fields become editable.
            Every action is recorded in the audit trail.
          </p>
        </div>

        <div className="mt-4 rounded-card border border-hairline bg-surface-subtle/60 p-4">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-overline text-slate">
            <Mail className="h-3 w-3" aria-hidden="true" />
            Delivery
          </p>
          <p className="mt-1.5 text-[11.5px] leading-5 text-slate">
            Invitations are sent by {workspaceName} from the workspace email queue. Delivery failures
            are recorded and can be retried from the document page.
          </p>
          <p className="mt-1.5 text-[10.5px] text-placeholder">Prepared {formatDateTime(new Date().toISOString())}</p>
        </div>
      </aside>
    </div>
  );
}
