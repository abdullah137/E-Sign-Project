import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getDocumentDetail, validateDocumentForSend } from "@/lib/documents";
import { getPlan } from "@/lib/plans";
import { env } from "@/lib/env";
import { Breadcrumbs } from "@/components/ui/page-header";
import { SendReview } from "@/components/documents/send-review";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Send for signing" };

const steps = [
  { label: "Upload", done: true },
  { label: "Prepare", done: true },
  { label: "Review & send", done: false, current: true },
];

export default async function SendDocumentPage({
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
  if (detail.document.status !== "DRAFT") {
    redirect(`/app/documents/${id}`);
  }
  const plan = getPlan(ctx.workspace.plan);
  const issues = validateDocumentForSend(db, detail.document, plan);
  const fieldsByRecipient = new Map<string, number>();
  for (const field of detail.fields) {
    fieldsByRecipient.set(field.recipient_id, (fieldsByRecipient.get(field.recipient_id) ?? 0) + 1);
  }
  const original = detail.originalFile;
  if (!original) notFound();

  return (
    <div className="page-container py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "Documents", href: "/app/documents" },
          { label: detail.document.title, href: `/app/documents/${id}` },
          { label: "Review & send" },
        ]}
      />

      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="overline">Review & send</p>
          <h1 className="mt-1.5 font-serif text-[32px] leading-[40px] tracking-[-0.015em] text-ink sm:text-[38px] sm:leading-[46px]">
            Ready to send?
          </h1>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-6 text-slate">
            Confirm recipients, message and expiry. You can still return to the editor before the
            invitations leave your workspace.
          </p>
        </div>
        <ol className="flex items-center gap-1.5" aria-label="Preparation steps">
          {steps.map((step, index) => (
            <li key={step.label} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-6 items-center gap-1.5 rounded-pill px-2.5 text-[11px] font-semibold",
                  step.current
                    ? "bg-ink text-white"
                    : "bg-success-bg text-success-text",
                )}
              >
                {index + 1}. {step.label}
              </span>
              {index < steps.length - 1 ? (
                <span className="h-px w-3 bg-[rgba(18,20,23,0.16)]" aria-hidden="true" />
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8">
        <SendReview
          documentId={detail.document.id}
          title={detail.document.title}
          fileName={original.original_filename}
          pageCount={original.page_count}
          recipients={detail.recipients.map((recipient) => ({
            id: recipient.id,
            name: recipient.name,
            email: recipient.email,
            fieldCount: fieldsByRecipient.get(recipient.id) ?? 0,
          }))}
          fields={detail.fields.length}
          issues={issues}
          initialMessage={detail.document.message}
          defaultExpiryDays={Math.min(90, Math.max(1, env.signingLinkTtlDays))}
          senderName={ctx.user.full_name || ctx.user.email}
          workspaceName={detail.workspace.brand_display_name || detail.workspace.name}
          documentSha256={original.sha256}
        />
      </div>

      <p className="mt-8 text-[11.5px] text-slate">
        Need to change something?{" "}
        <Link href={`/app/documents/${id}/prepare`} className="font-semibold text-gold-text hover:underline">
          Return to the field editor
        </Link>
        .
      </p>
    </div>
  );
}
