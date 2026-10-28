import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getDocumentDetail } from "@/lib/documents";
import { getPlan } from "@/lib/plans";
import { isAdmin } from "@/lib/auth";
import { PrepareEditor, type EditorField } from "@/components/documents/prepare-editor";
import type { FieldType } from "@/lib/field-types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Prepare document" };

export default async function PrepareDocumentPage({
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
  if (!detail.document.original_file_id) notFound();
  if (detail.document.status !== "DRAFT") {
    redirect(`/app/documents/${id}`);
  }
  if (!isAdmin(ctx.membership.role) && detail.document.created_by !== ctx.user.id) {
    redirect(`/app/documents/${id}`);
  }
  const plan = getPlan(ctx.workspace.plan);

  const fields: EditorField[] = detail.fields.map((field) => ({
    id: field.id,
    pageIndex: field.page_index,
    type: field.type as FieldType,
    label: field.label,
    recipientId: field.recipient_id,
    required: field.required === 1,
    x: field.x,
    y: field.y,
    width: field.width,
    height: field.height,
    rotation: field.rotation ?? 0,
  }));

  return (
    <PrepareEditor
      documentId={detail.document.id}
      initialTitle={detail.document.title}
      initialMessage={detail.document.message}
      initialRecipients={detail.recipients.map((recipient) => ({
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
      }))}
      initialFields={fields}
      fileUrl={`/api/documents/${detail.document.id}/file`}
      recipientLimit={plan.recipientsPerDocument}
      planName={plan.name}
    />
  );
}
