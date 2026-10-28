import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import { requireWorkspace, isAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getDocumentDetail, getAuditForDocument } from "@/lib/documents";
import { verifyAuditChain } from "@/lib/audit";
import { env } from "@/lib/env";
import { Breadcrumbs } from "@/components/ui/page-header";
import { StatusBadge, RecipientStatusBadge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { AuditTimeline } from "@/components/documents/audit-timeline";
import { DocumentActions, RemindButton } from "@/components/documents/document-actions";
import { formatBytes, formatDate, formatDateTime, relativeTime } from "@/lib/format";
import type { RecipientStatus } from "@/lib/documents";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Document" };

function recipientTimestamp(status: RecipientStatus, recipient: {
  invite_sent_at: string | null;
  opened_at: string | null;
  consent_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
}): string | null {
  if (status === "SIGNED") return recipient.signed_at;
  if (status === "DECLINED") return recipient.declined_at;
  if (status === "CONSENTED") return recipient.consent_at;
  if (status === "OPENED") return recipient.opened_at;
  if (status === "INVITED") return recipient.invite_sent_at;
  return null;
}

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireWorkspace();
  const db = getDb();
  let detail;
  try {
    detail = getDocumentDetail(db, ctx.workspace.id, id);
  } catch {
    notFound();
  }
  const doc = detail.document;
  const events = getAuditForDocument(db, doc.id);
  const chain = verifyAuditChain(db, doc.id);
  const canManage = isAdmin(ctx.membership.role) || doc.created_by === ctx.user.id;
  const signed = detail.recipients.filter((recipient) => recipient.status === "SIGNED").length;
  const signers = detail.recipients.filter((recipient) => recipient.role === "signer");
  const lastActivity = events[events.length - 1]?.at ?? doc.updated_at;
  const canDownloadFinal = doc.status === "COMPLETED" && detail.finalizedFile;

  return (
    <div className="page-container py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Documents", href: "/app/documents" },
          { label: doc.title },
        ]}
      />

      <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusBadge status={doc.status} />
            {doc.status === "PENDING" && doc.expires_at ? (
              <span className="text-[11.5px] text-slate">Expires {formatDate(doc.expires_at)}</span>
            ) : null}
            {doc.status === "COMPLETED" && doc.completed_at ? (
              <span className="text-[11.5px] text-slate">Completed {formatDate(doc.completed_at)}</span>
            ) : null}
          </div>
          <h1 className="mt-2.5 break-words font-serif text-[32px] leading-[40px] tracking-[-0.015em] text-ink sm:text-[38px] sm:leading-[46px]">
            {doc.title}
          </h1>
          <p className="mt-1.5 text-[12.5px] text-slate">
            Uploaded by {detail.creatorName} · {formatDateTime(doc.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {doc.status === "DRAFT" ? (
            <>
              <Link href={`/app/documents/${doc.id}/prepare`} className={buttonStyles("primary", "md")}>
                Continue preparing
              </Link>
              <a
                href={`/api/documents/${doc.id}/download?kind=original&download=1`}
                className={buttonStyles("secondary", "md")}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Original PDF
              </a>
            </>
          ) : null}
          {canDownloadFinal ? (
            <>
              <a
                href={`/api/documents/${doc.id}/download?kind=finalized&download=1`}
                className={buttonStyles("primary", "md")}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Signed PDF
              </a>
              <a
                href={`/api/documents/${doc.id}/download?kind=audit&download=1`}
                className={buttonStyles("secondary", "md")}
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Audit certificate
              </a>
            </>
          ) : null}
          <DocumentActions documentId={doc.id} status={doc.status} canManage={canManage} />
        </div>
      </div>

      {doc.status === "VOIDED" ? (
        <div className="mt-6 flex items-start gap-2.5 rounded-card border border-[rgba(186,26,26,0.18)] bg-[#FBEAEA] px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
          <div>
            <p className="text-[12.5px] font-semibold text-danger">This signing request was withdrawn</p>
            <p className="mt-0.5 text-[12px] leading-5 text-danger/80">
              {doc.void_reason || "No reason was recorded."} · {formatDateTime(doc.voided_at)}
            </p>
          </div>
        </div>
      ) : null}
      {doc.status === "EXPIRED" ? (
        <div className="mt-6 flex items-start gap-2.5 rounded-card border border-hairline bg-surface-subtle px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate" aria-hidden="true" />
          <div>
            <p className="text-[12.5px] font-semibold text-ink">This request expired</p>
            <p className="mt-0.5 text-[12px] leading-5 text-slate">
              The signing window ended {formatDate(doc.expires_at)}. Outstanding links are inactive.
            </p>
          </div>
        </div>
      ) : null}
      {doc.status === "FINALIZING" ? (
        <div className="mt-6 flex items-start gap-2.5 rounded-card border border-[rgba(184,149,88,0.28)] bg-warning-bg/60 px-4 py-3.5">
          <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-text" aria-hidden="true" />
          <div>
            <p className="text-[12.5px] font-semibold text-ink">All signatures are in — finalizing</p>
            <p className="mt-0.5 text-[12px] leading-5 text-slate">
              The signed PDF is being generated. If this message persists, retry finalization above.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section className="grid gap-4 sm:grid-cols-3" aria-label="Document facts">
            <div className="rounded-card border border-hairline bg-surface p-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-overline text-slate">File</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <FileText className="h-3.5 w-3.5 text-slate" aria-hidden="true" />
                {detail.originalFile?.page_count ?? 0} page
                {(detail.originalFile?.page_count ?? 0) === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 truncate text-[11.5px] text-slate">
                {detail.originalFile ? formatBytes(detail.originalFile.bytes) : "—"} ·{" "}
                {detail.originalFile?.original_filename}
              </p>
            </div>
            <div className="rounded-card border border-hairline bg-surface p-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-overline text-slate">Recipients</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <Users className="h-3.5 w-3.5 text-slate" aria-hidden="true" />
                {signed} of {signers.length} signed
              </p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{ width: `${signers.length ? (signed / signers.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="rounded-card border border-hairline bg-surface p-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-overline text-slate">Last activity</p>
              <p className="mt-1.5 text-[13px] font-semibold text-ink">{relativeTime(lastActivity)}</p>
              <p className="mt-0.5 text-[11.5px] text-slate">{formatDateTime(lastActivity)}</p>
            </div>
          </section>

          <section className="rounded-card border border-hairline bg-surface">
            <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
              <h2 className="font-serif text-[22px] leading-7 text-ink">Recipients</h2>
              <span className="text-[11.5px] text-slate">
                {signers.length} signer{signers.length === 1 ? "" : "s"} · parallel signing
              </span>
            </div>
            {detail.recipients.length === 0 ? (
              <div className="px-5 py-6 text-[12.5px] text-slate">
                No recipients have been added yet.{" "}
                {doc.status === "DRAFT" ? (
                  <Link href={`/app/documents/${doc.id}/prepare`} className="font-semibold text-gold-text hover:underline">
                    Add recipients and fields
                  </Link>
                ) : null}
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {detail.recipients.map((recipient) => {
                  const timestamp = recipientTimestamp(recipient.status, recipient);
                  const canRemind =
                    canManage &&
                    doc.status === "PENDING" &&
                    ["PENDING", "INVITED", "OPENED", "CONSENTED"].includes(recipient.status);
                  const fieldCount = detail.fields.filter(
                    (field) => field.recipient_id === recipient.id,
                  ).length;
                  return (
                    <li key={recipient.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-subtle text-[11px] font-semibold text-ink-secondary">
                          {(recipient.name || recipient.email).slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-ink">
                            {recipient.name || "Unnamed recipient"}
                          </p>
                          <p className="truncate text-[11.5px] text-slate">
                            {recipient.email}
                            {fieldCount > 0 ? ` · ${fieldCount} field${fieldCount === 1 ? "" : "s"}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-11 sm:pl-0">
                        <RecipientStatusBadge status={recipient.status} />
                        {timestamp ? (
                          <span
                            className="text-[10.5px] text-slate"
                            title={formatDateTime(timestamp)}
                          >
                            {relativeTime(timestamp)}
                          </span>
                        ) : null}
                        {canRemind ? (
                          <RemindButton
                            documentId={doc.id}
                            recipientId={recipient.id}
                            recipientName={recipient.name || recipient.email}
                            showDevOutbox={env.showDevOutbox}
                          />
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-card border border-hairline bg-surface p-5">
            <h2 className="font-serif text-[22px] leading-7 text-ink">Files & evidence</h2>
            <p className="mt-1 text-[12px] text-slate">
              The original file is preserved unchanged. Completed documents and their audit records are
              stored separately.
            </p>
            <ul className="mt-4 space-y-2">
              <li className="flex items-center justify-between gap-3 rounded border border-hairline px-3.5 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-slate" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-ink">Original PDF</p>
                    <p className="text-[11px] text-slate">
                      {detail.originalFile ? `${formatBytes(detail.originalFile.bytes)} · SHA-256 ${detail.originalFile.sha256.slice(0, 12)}…` : "Unavailable"}
                    </p>
                  </div>
                </div>
                {detail.originalFile ? (
                  <a
                    href={`/api/documents/${doc.id}/download?kind=original&download=1`}
                    className="shrink-0 text-[12px] font-semibold text-gold-text hover:underline"
                  >
                    Download
                  </a>
                ) : null}
              </li>
              <li className="flex items-center justify-between gap-3 rounded border border-hairline px-3.5 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileCheck2 className="h-4 w-4 shrink-0 text-slate" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-ink">Completed PDF</p>
                    <p className="text-[11px] text-slate">
                      {detail.finalizedFile
                        ? `${formatBytes(detail.finalizedFile.bytes)} · SHA-256 ${detail.finalizedFile.sha256.slice(0, 12)}…`
                        : doc.status === "COMPLETED"
                          ? "Processing"
                          : "Available after all required signatures"}
                    </p>
                  </div>
                </div>
                {canDownloadFinal ? (
                  <a
                    href={`/api/documents/${doc.id}/download?kind=finalized&download=1`}
                    className="shrink-0 text-[12px] font-semibold text-gold-text hover:underline"
                  >
                    Download
                  </a>
                ) : null}
              </li>
              <li className="flex items-center justify-between gap-3 rounded border border-hairline px-3.5 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-slate" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-ink">Audit certificate</p>
                    <p className="text-[11px] text-slate">
                      {chain.valid
                        ? `${events.length} hash-chained event${events.length === 1 ? "" : "s"}`
                        : "Audit chain requires review"}
                    </p>
                  </div>
                </div>
                {canDownloadFinal ? (
                  <a
                    href={`/api/documents/${doc.id}/download?kind=audit&download=1`}
                    className="shrink-0 text-[12px] font-semibold text-gold-text hover:underline"
                  >
                    Download
                  </a>
                ) : null}
              </li>
            </ul>
            <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-4 text-slate">
              <ShieldCheck className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
              The certificate is an evidentiary record, not a legal opinion. The effect of an electronic
              signature depends on the applicable jurisdiction, identity assurance and consent.
            </p>
          </section>

          {doc.status === "DRAFT" ? (
            <div className="rounded-card border border-dashed border-hairline-strong bg-surface-subtle/50 p-5">
              <p className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
                <Mail className="h-4 w-4 text-slate" aria-hidden="true" />
                This draft has not been sent
              </p>
              <p className="mt-1 text-[12px] leading-5 text-slate">
                Continue preparing to assign fields and choose recipients, then send from the review step.
              </p>
              <Link
                href={`/app/documents/${doc.id}/prepare`}
                className={buttonStyles("secondary", "sm", "mt-3")}
              >
                Open field editor
              </Link>
            </div>
          ) : null}
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-card border border-hairline bg-surface p-5">
            <AuditTimeline events={events} auditValid={chain.valid} />
            <div className="mt-4 flex items-center gap-1.5 border-t border-hairline pt-3 text-[10.5px] text-slate">
              <CheckCircle2 className="h-3 w-3 text-success-text" aria-hidden="true" />
              Times are recorded in UTC in the certificate
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
