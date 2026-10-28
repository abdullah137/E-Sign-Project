import { NextResponse } from "next/server";
import { assertSameOrigin, apiError, apiOk, clientIp, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb, transaction } from "@/lib/db";
import {
  ensureDocumentAccess,
  getDocument,
  getDocumentFiles,
  getFields,
  getRecipients,
  updateDraftMeta,
} from "@/lib/documents";
import { draftSaveSchema, documentMetaSchema } from "@/lib/validation";
import { isValidRect, clampRect } from "@/lib/pdf/coords";
import { nowIso } from "@/lib/ids";
import { ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    const db = getDb();
    const doc = getDocument(db, id, ctx.workspace.id);
    if (!doc) return apiError("Document not found.", 404, "not_found");
    ensureDocumentAccess(ctx.membership.role, doc, ctx.user.id, "edit");
    if (doc.status !== "DRAFT") {
      return apiError("Only drafts can be edited. This document has already been sent.", 409, "conflict");
    }
    const parsed = await parseJsonBody(request, draftSaveSchema);
    if ("response" in parsed) return parsed.response;
    const { title, message, recipients, fields } = parsed.data;

    const files = getDocumentFiles(db, doc.id);
    if (!files.original) return apiError("The original PDF is missing.", 409, "conflict");
    const pageCount = files.original.page_count;

    const recipientIds = new Set<string>();
    for (const recipient of recipients) {
      if (recipientIds.has(recipient.id)) {
        return apiError("Two recipients share the same identifier.", 422, "validation_error");
      }
      recipientIds.add(recipient.id);
    }
    const fieldIds = new Set<string>();
    for (const field of fields) {
      if (fieldIds.has(field.id)) {
        return apiError("Two fields share the same identifier.", 422, "validation_error");
      }
      fieldIds.add(field.id);
      if (!recipientIds.has(field.recipientId)) {
        return apiError("A field is assigned to an unknown recipient.", 422, "validation_error");
      }
      if (field.pageIndex < 0 || field.pageIndex >= pageCount) {
        return apiError("A field is placed on a page that does not exist.", 422, "validation_error");
      }
      const rect = clampRect({
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
      });
      if (!isValidRect(rect)) {
        return apiError("A field is outside the page boundary.", 422, "validation_error");
      }
    }

    const now = nowIso();
    transaction(db, () => {
      db.prepare("UPDATE documents SET title = ?, message = ?, updated_at = ? WHERE id = ?").run(
        title,
        message ?? null,
        now,
        doc.id,
      );

      const existingRecipients = getRecipients(db, doc.id);
      for (const [index, recipient] of recipients.entries()) {
        const existing = existingRecipients.find((item) => item.id === recipient.id);
        if (existing) {
          db.prepare(
            "UPDATE recipients SET name = ?, email = ?, email_normalized = ?, signing_order = ?, updated_at = ? WHERE id = ? AND document_id = ?",
          ).run(
            recipient.name,
            recipient.email,
            recipient.email.trim().toLowerCase(),
            recipient.order ?? index + 1,
            now,
            recipient.id,
            doc.id,
          );
        } else {
          db.prepare(
            `INSERT INTO recipients
              (id, document_id, name, email, email_normalized, role, signing_order, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'signer', ?, 'PENDING', ?, ?)`,
          ).run(
            recipient.id,
            doc.id,
            recipient.name,
            recipient.email,
            recipient.email.trim().toLowerCase(),
            recipient.order ?? index + 1,
            now,
            now,
          );
        }
      }

      const keepRecipientIds = new Set(recipients.map((recipient) => recipient.id));
      const existingFields = getFields(db, doc.id);
      for (const field of existingFields) {
        if (!keepRecipientIds.has(field.recipient_id) || !fieldIds.has(field.id)) {
          db.prepare("DELETE FROM fields WHERE id = ? AND document_id = ?").run(field.id, doc.id);
        }
      }
      for (const recipient of existingRecipients) {
        if (!keepRecipientIds.has(recipient.id)) {
          db.prepare("DELETE FROM recipients WHERE id = ? AND document_id = ?").run(recipient.id, doc.id);
        }
      }

      for (const field of fields) {
        const rect = clampRect({
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
        });
        const existing = existingFields.find((item) => item.id === field.id);
        if (existing && keepRecipientIds.has(existing.recipient_id) && fieldIds.has(existing.id)) {
          db.prepare(
            `UPDATE fields SET page_index = ?, type = ?, label = ?, recipient_id = ?, required = ?,
             x = ?, y = ?, width = ?, height = ?, rotation = ?, font_size = ?, updated_at = ?
             WHERE id = ? AND document_id = ?`,
          ).run(
            field.pageIndex,
            field.type,
            field.label ?? null,
            field.recipientId,
            field.required ? 1 : 0,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            field.rotation ?? 0,
            field.fontSize ?? null,
            now,
            field.id,
            doc.id,
          );
        } else {
          db.prepare(
            `INSERT INTO fields
              (id, document_id, page_index, type, label, recipient_id, required, x, y, width, height, rotation, font_size, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            field.id,
            doc.id,
            field.pageIndex,
            field.type,
            field.label ?? null,
            field.recipientId,
            field.required ? 1 : 0,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            field.rotation ?? 0,
            field.fontSize ?? null,
            now,
            now,
          );
        }
      }
    });

    return apiOk({
      ok: true,
      savedAt: now,
      recipients: getRecipients(db, doc.id).map((recipient) => ({
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        order: recipient.signing_order,
      })),
      fields: getFields(db, doc.id).map((field) => ({
        id: field.id,
        pageIndex: field.page_index,
        type: field.type,
        label: field.label,
        recipientId: field.recipient_id,
        required: field.required === 1,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    const db = getDb();
    const doc = getDocument(db, id, ctx.workspace.id);
    if (!doc) return apiError("Document not found.", 404, "not_found");
    ensureDocumentAccess(ctx.membership.role, doc, ctx.user.id, "edit");
    const parsed = await parseJsonBody(request, documentMetaSchema);
    if ("response" in parsed) return parsed.response;
    if (doc.status !== "DRAFT") {
      throw new ValidationError("Only drafts can be edited.");
    }
    updateDraftMeta(db, doc.id, ctx.workspace.id, {
      title: parsed.data.title,
      message: parsed.data.message,
    });
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ctx = await requireApiContext();
    const db = getDb();
    const doc = getDocument(db, id, ctx.workspace.id);
    if (!doc) return apiError("Document not found.", 404, "not_found");
    const files = getDocumentFiles(db, doc.id);
    return apiOk({
      document: doc,
      files: { original: files.original, finalized: files.finalized },
      recipients: getRecipients(db, doc.id),
      fields: getFields(db, doc.id),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
