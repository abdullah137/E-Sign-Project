import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { env } from "./env";
import { addDaysIso, hashToken, newId, newToken, nowIso, normalizeEmail, sha256Hex } from "./ids";
import { appendAuditEvent, verifyAuditChain, getAuditEvents, type AuditEventRow } from "./audit";
import {
  queueEmail,
  appLink,
  invitationEmail,
  type EmailInput,
} from "./email";
import { getPlan, type PlanDefinition } from "./plans";
import { normalizeRotation, isValidRect } from "./pdf/coords";
import { finalizePdf, type FieldForFinalization, type FinalizeSignature } from "./pdf/finalize";
import { readStoredObject, saveBuffer, mediaTypeForKey, parseImageDataUrl } from "./storage";
import { transaction } from "./db";
import {
  FieldType,
  FIELD_TYPES,
  isValidEmail,
} from "./field-types";
import {
  ConflictError,
  DomainError,
  NotFoundError,
  PermissionError,
  ValidationError,
} from "./errors";

export type DocumentStatus =
  | "DRAFT"
  | "PENDING"
  | "FINALIZING"
  | "COMPLETED"
  | "VOIDED"
  | "EXPIRED"
  | "DELETED";

export type RecipientStatus =
  | "PENDING"
  | "INVITED"
  | "OPENED"
  | "CONSENTED"
  | "SIGNED"
  | "DECLINED"
  | "REVOKED"
  | "EXPIRED";

export interface DocumentRow {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  status: DocumentStatus;
  message: string | null;
  original_file_id: string | null;
  finalized_file_id: string | null;
  sent_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  void_reason: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentFileRow {
  id: string;
  document_id: string;
  kind: "original" | "finalized";
  original_filename: string;
  mime: string;
  bytes: number;
  sha256: string;
  storage_key: string;
  page_count: number;
  encrypted: number;
  created_at: string;
}

export interface RecipientRow {
  id: string;
  document_id: string;
  name: string;
  email: string;
  email_normalized: string;
  role: string;
  signing_order: number;
  status: RecipientStatus;
  invite_sent_at: string | null;
  opened_at: string | null;
  consent_at: string | null;
  consent_version: string | null;
  signed_at: string | null;
  declined_at: string | null;
  token_hash: string | null;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FieldRow {
  id: string;
  document_id: string;
  page_index: number;
  type: FieldType;
  label: string | null;
  recipient_id: string;
  required: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  font_size: number | null;
  options_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface FieldValueRow {
  id: string;
  document_id: string;
  field_id: string;
  recipient_id: string;
  value_text: string | null;
  signature_asset_id: string | null;
  signature_mode: string | null;
  checked: number | null;
  recorded_at: string;
  updated_at: string;
}

export interface WorkspaceRowLite {
  id: string;
  name: string;
  plan: string;
  brand_display_name: string | null;
  brand_color: string | null;
  owner_id: string;
}

export interface DocumentListRow extends DocumentRow {
  recipient_count: number;
  signed_count: number;
  field_count: number;
  prepared_recipient_count: number;
  original_filename: string | null;
  page_count: number | null;
  file_bytes: number | null;
}

export interface DashboardStats {
  pending: number;
  completed: number;
  viewed: number;
  drafts: number;
  documentsThisMonth: number;
}

export interface SendValidationIssue {
  scope: "document" | "recipient" | "field";
  message: string;
  recipientId?: string;
  fieldId?: string;
}

export const CONSENT_VERSION = "esign-consent-1.0";

export function startOfMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function getDocument(
  db: DatabaseSync,
  documentId: string,
  workspaceId?: string,
): DocumentRow | undefined {
  const row = workspaceId
    ? db
        .prepare("SELECT * FROM documents WHERE id = ? AND workspace_id = ?")
        .get(documentId, workspaceId)
    : db.prepare("SELECT * FROM documents WHERE id = ?").get(documentId);
  return row as unknown as DocumentRow | undefined;
}

export function getDocumentFiles(
  db: DatabaseSync,
  documentId: string,
): { original: DocumentFileRow | null; finalized: DocumentFileRow | null } {
  const rows = db
    .prepare("SELECT * FROM document_files WHERE document_id = ? ORDER BY created_at ASC")
    .all(documentId) as unknown as DocumentFileRow[];
  return {
    original: rows.find((row) => row.kind === "original") ?? null,
    finalized: rows.find((row) => row.kind === "finalized") ?? null,
  };
}

export function getRecipients(db: DatabaseSync, documentId: string): RecipientRow[] {
  return db
    .prepare("SELECT * FROM recipients WHERE document_id = ? ORDER BY signing_order ASC, created_at ASC")
    .all(documentId) as unknown as RecipientRow[];
}

export function getFields(db: DatabaseSync, documentId: string): FieldRow[] {
  return db
    .prepare("SELECT * FROM fields WHERE document_id = ? ORDER BY page_index ASC, created_at ASC")
    .all(documentId) as unknown as FieldRow[];
}

export function getFieldValues(db: DatabaseSync, documentId: string): FieldValueRow[] {
  return db
    .prepare("SELECT * FROM field_values WHERE document_id = ?")
    .all(documentId) as unknown as FieldValueRow[];
}

export function getWorkspace(db: DatabaseSync, workspaceId: string): WorkspaceRowLite | undefined {
  return db
    .prepare("SELECT id, name, plan, brand_display_name, brand_color, owner_id FROM workspaces WHERE id = ?")
    .get(workspaceId) as unknown as WorkspaceRowLite | undefined;
}

export function expireStaleDocuments(db: DatabaseSync, workspaceId?: string): void {
  const now = nowIso();
  const rows = (
    workspaceId
      ? db
          .prepare(
            "SELECT id, workspace_id FROM documents WHERE status = 'PENDING' AND expires_at IS NOT NULL AND expires_at < ? AND workspace_id = ?",
          )
          .all(now, workspaceId)
      : db
          .prepare(
            "SELECT id, workspace_id FROM documents WHERE status = 'PENDING' AND expires_at IS NOT NULL AND expires_at < ?",
          )
          .all(now)
  ) as unknown as Array<{ id: string; workspace_id: string }>;

  for (const row of rows) {
    transaction(db, () => {
      const changed = db
        .prepare(
          "UPDATE documents SET status = 'EXPIRED', updated_at = ? WHERE id = ? AND status = 'PENDING'",
        )
        .run(now, row.id).changes;
      if (!changed) return;
      db.prepare(
        "UPDATE recipients SET status = 'EXPIRED', token_hash = NULL, updated_at = ? WHERE document_id = ? AND status IN ('PENDING','INVITED','OPENED','CONSENTED')",
      ).run(now, row.id);
      appendAuditEvent(db, {
        documentId: row.id,
        workspaceId: row.workspace_id,
        eventType: "document.expired",
        actorKind: "system",
        actorLabel: "SignFlow",
        metadata: {},
      });
    });
  }
}

export async function createDraftDocument(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    userId: string;
    userLabel: string;
    title: string;
    fileName: string;
    bytes: Buffer;
    pageCount: number;
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<DocumentRow> {
  const documentId = newId("doc");
  const saved = saveBuffer(input.workspaceId, input.bytes, "pdf");
  const now = nowIso();
  transaction(db, () => {
    db.prepare(
      `INSERT INTO documents (id, workspace_id, created_by, title, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'DRAFT', ?, ?)`,
    ).run(documentId, input.workspaceId, input.userId, input.title, now, now);
    const fileId = newId("fil");
    db.prepare(
      `INSERT INTO document_files
        (id, document_id, kind, original_filename, mime, bytes, sha256, storage_key, page_count, encrypted, created_at)
       VALUES (?, ?, 'original', ?, 'application/pdf', ?, ?, ?, ?, 0, ?)`,
    ).run(
      fileId,
      documentId,
      input.fileName,
      saved.bytes,
      saved.sha256,
      saved.storageKey,
      input.pageCount,
      now,
    );
    db.prepare("UPDATE documents SET original_file_id = ? WHERE id = ?").run(fileId, documentId);
    appendAuditEvent(db, {
      documentId,
      workspaceId: input.workspaceId,
      eventType: "document.created",
      actorKind: "sender",
      actorId: input.userId,
      actorLabel: input.userLabel,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: {
        fileName: input.fileName,
        bytes: saved.bytes,
        pageCount: input.pageCount,
        sha256: saved.sha256,
      },
    });
  });
  return getDocument(db, documentId, input.workspaceId) as DocumentRow;
}

export function updateDraftMeta(
  db: DatabaseSync,
  documentId: string,
  workspaceId: string,
  patch: { title?: string; message?: string | null },
): void {
  const doc = getDocument(db, documentId, workspaceId);
  if (!doc) throw new NotFoundError("Document not found.");
  if (doc.status !== "DRAFT") throw new ConflictError("Only drafts can be edited.");
  const title = patch.title !== undefined ? patch.title.trim() : doc.title;
  if (!title) throw new ValidationError("A document title is required.");
  if (title.length > 160) throw new ValidationError("The title must be 160 characters or fewer.");
  if (patch.message && patch.message.length > 2000) {
    throw new ValidationError("The message must be 2,000 characters or fewer.");
  }
  db.prepare("UPDATE documents SET title = ?, message = ?, updated_at = ? WHERE id = ?").run(
    title,
    patch.message !== undefined ? patch.message : doc.message,
    nowIso(),
    documentId,
  );
}

export function validateDocumentForSend(
  db: DatabaseSync,
  doc: DocumentRow,
  plan: PlanDefinition,
): SendValidationIssue[] {
  const issues: SendValidationIssue[] = [];
  if (doc.status !== "DRAFT") {
    issues.push({ scope: "document", message: "This document has already been sent." });
    return issues;
  }
  if (!doc.title.trim()) issues.push({ scope: "document", message: "Add a document title." });
  const files = getDocumentFiles(db, doc.id);
  if (!files.original) {
    issues.push({ scope: "document", message: "The original PDF is missing. Upload the document again." });
  }
  const recipients = getRecipients(db, doc.id);
  const fields = getFields(db, doc.id);
  if (recipients.length === 0) {
    issues.push({ scope: "document", message: "Add at least one recipient." });
  }
  if (recipients.length > plan.recipientsPerDocument) {
    issues.push({
      scope: "document",
      message: `Your ${plan.name} plan allows ${plan.recipientsPerDocument} recipients per document.`,
    });
  }
  const seen = new Set<string>();
  for (const recipient of recipients) {
    if (!recipient.name.trim()) {
      issues.push({
        scope: "recipient",
        recipientId: recipient.id,
        message: "Add the recipient's name.",
      });
    }
    if (!isValidEmail(recipient.email)) {
      issues.push({
        scope: "recipient",
        recipientId: recipient.id,
        message: `“${recipient.email || "Recipient"}” does not have a valid email address.`,
      });
    }
    if (seen.has(recipient.email_normalized)) {
      issues.push({
        scope: "recipient",
        recipientId: recipient.id,
        message: `Duplicate recipient email: ${recipient.email}.`,
      });
    }
    seen.add(recipient.email_normalized);
    if (!fields.some((field) => field.recipient_id === recipient.id)) {
      issues.push({
        scope: "recipient",
        recipientId: recipient.id,
        message: `Assign at least one field to ${recipient.name || recipient.email}.`,
      });
    }
  }
  const recipientIds = new Set(recipients.map((recipient) => recipient.id));
  for (const field of fields) {
    if (!recipientIds.has(field.recipient_id)) {
      issues.push({
        scope: "field",
        fieldId: field.id,
        message: "A field is assigned to a recipient that no longer exists.",
      });
    }
    if (files.original && (field.page_index < 0 || field.page_index >= files.original.page_count)) {
      issues.push({
        scope: "field",
        fieldId: field.id,
        message: "A field is placed on a page that does not exist.",
      });
    }
    if (!FIELD_TYPES.includes(field.type)) {
      issues.push({ scope: "field", fieldId: field.id, message: "A field has an unsupported type." });
    }
    if (
      !isValidRect({ x: field.x, y: field.y, width: field.width, height: field.height })
    ) {
      issues.push({
        scope: "field",
        fieldId: field.id,
        message: "A field extends beyond the page boundary.",
      });
    }
  }
  const quota = countDocumentsThisMonth(db, doc.workspace_id);
  if (quota >= plan.documentsPerMonth) {
    issues.push({
      scope: "document",
      message: `You have reached the ${plan.documentsPerMonth}-document monthly limit on the ${plan.name} plan.`,
    });
  }
  return issues;
}

export function countDocumentsThisMonth(db: DatabaseSync, workspaceId: string): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS count FROM documents WHERE workspace_id = ? AND status != 'DELETED' AND created_at >= ?",
    )
    .get(workspaceId, startOfMonthIso()) as { count: number };
  return Number(row.count);
}

export interface SendResult {
  links: Array<{ recipientId: string; email: string; name: string; link: string }>;
  expiresAt: string;
}

export async function sendDocument(
  db: DatabaseSync,
  input: {
    documentId: string;
    workspaceId: string;
    actor: { id: string; label: string; email: string };
    message?: string | null;
    expiresInDays?: number;
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<SendResult> {
  const doc = getDocument(db, input.documentId, input.workspaceId);
  if (!doc) throw new NotFoundError("Document not found.");
  const workspace = getWorkspace(db, input.workspaceId);
  if (!workspace) throw new NotFoundError("Workspace not found.");
  const plan = getPlan(workspace.plan);
  const issues = validateDocumentForSend(db, doc, plan);
  if (issues.length) {
    throw new ValidationError("This document is not ready to send.", issues);
  }
  const days = Math.min(90, Math.max(1, Math.round(input.expiresInDays ?? env.signingLinkTtlDays)));
  const expiresAt = addDaysIso(days);
  const message = input.message !== undefined ? input.message : doc.message;
  if (message && message.length > 2000) {
    throw new ValidationError("The message must be 2,000 characters or fewer.");
  }
  const recipients = getRecipients(db, doc.id);
  const links: SendResult["links"] = [];
  const now = nowIso();

  transaction(db, () => {
    const changed = db
      .prepare(
        "UPDATE documents SET status = 'PENDING', sent_at = ?, expires_at = ?, message = ?, updated_at = ? WHERE id = ? AND status = 'DRAFT'",
      )
      .run(now, expiresAt, message ?? null, now, doc.id).changes;
    if (!changed) throw new ConflictError("This document has already been sent.");
    for (const recipient of recipients) {
      const token = newToken(32);
      db.prepare(
        `UPDATE recipients SET status = 'INVITED', invite_sent_at = ?, token_hash = ?, token_expires_at = ?, updated_at = ? WHERE id = ?`,
      ).run(now, hashToken(token), expiresAt, now, recipient.id);
      links.push({
        recipientId: recipient.id,
        email: recipient.email,
        name: recipient.name,
        link: appLink(`/sign/${token}`),
      });
      appendAuditEvent(db, {
        documentId: doc.id,
        workspaceId: doc.workspace_id,
        eventType: "recipient.invited",
        actorKind: "sender",
        actorId: input.actor.id,
        actorLabel: input.actor.label,
        ip: input.ip,
        userAgent: input.userAgent,
        metadata: { recipientId: recipient.id, email: recipient.email },
      });
    }
    appendAuditEvent(db, {
      documentId: doc.id,
      workspaceId: doc.workspace_id,
      eventType: "document.sent",
      actorKind: "sender",
      actorId: input.actor.id,
      actorLabel: input.actor.label,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: {
        recipients: recipients.length,
        expiresAt,
        documentSha256: getDocumentFiles(db, doc.id).original?.sha256 ?? null,
      },
    });
  });

  const workspaceName = workspace.brand_display_name || workspace.name;
  for (const link of links) {
    const recipient = recipients.find((item) => item.id === link.recipientId) as RecipientRow;
    queueEmail(db, {
      kind: "signing_invitation",
      to: link.email,
      workspaceId: workspace.id,
      documentId: doc.id,
      recipientId: recipient.id,
      ...invitationEmail({
        recipientName: recipient.name,
        senderName: input.actor.label,
        documentTitle: doc.title,
        workspaceName,
        link: link.link,
        expiresAt,
      }),
      meta: { link: link.link },
    });
  }
  return { links, expiresAt };
}

export function listDocuments(
  db: DatabaseSync,
  workspaceId: string,
  options: { status?: string; search?: string; limit?: number; offset?: number } = {},
): { items: DocumentListRow[]; total: number } {
  const conditions = ["d.workspace_id = ?", "d.status != 'DELETED'"];
  const params: Array<string | number> = [workspaceId];
  if (options.status && options.status !== "all") {
    conditions.push("d.status = ?");
    params.push(options.status.toUpperCase());
  }
  const search = options.search?.trim();
  if (search) {
    conditions.push(
      "(LOWER(d.title) LIKE ? OR EXISTS (SELECT 1 FROM recipients r WHERE r.document_id = d.id AND (LOWER(r.name) LIKE ? OR LOWER(r.email) LIKE ?)))",
    );
    const like = `%${search.toLowerCase()}%`;
    params.push(like, like, like);
  }
  const where = conditions.join(" AND ");
  const totalRow = db
    .prepare(`SELECT COUNT(*) AS count FROM documents d WHERE ${where}`)
    .get(...params) as { count: number };
  const limit = Math.min(100, Math.max(1, options.limit ?? 25));
  const offset = Math.max(0, options.offset ?? 0);
  const items = db
    .prepare(
      `SELECT d.*,
        (SELECT COUNT(*) FROM recipients r WHERE r.document_id = d.id) AS recipient_count,
        (SELECT COUNT(*) FROM recipients r WHERE r.document_id = d.id AND r.status = 'SIGNED') AS signed_count,
        (SELECT COUNT(*) FROM fields f WHERE f.document_id = d.id) AS field_count,
        (SELECT COUNT(DISTINCT r.recipient_id) FROM fields r WHERE r.document_id = d.id) AS prepared_recipient_count,
        (SELECT f.original_filename FROM document_files f WHERE f.document_id = d.id AND f.kind = 'original' LIMIT 1) AS original_filename,
        (SELECT f.page_count FROM document_files f WHERE f.document_id = d.id AND f.kind = 'original' LIMIT 1) AS page_count,
        (SELECT f.bytes FROM document_files f WHERE f.document_id = d.id AND f.kind = 'original' LIMIT 1) AS file_bytes
       FROM documents d WHERE ${where}
       ORDER BY d.updated_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as unknown as DocumentListRow[];
  return { items, total: Number(totalRow.count) };
}

export function countDocumentsByStatus(
  db: DatabaseSync,
  workspaceId: string,
): Record<string, number> {
  const rows = db
    .prepare(
      "SELECT status, COUNT(*) AS count FROM documents WHERE workspace_id = ? AND status != 'DELETED' GROUP BY status",
    )
    .all(workspaceId) as unknown as Array<{ status: string; count: number }>;
  const counts: Record<string, number> = {
    all: 0,
    DRAFT: 0,
    PENDING: 0,
    FINALIZING: 0,
    COMPLETED: 0,
    VOIDED: 0,
    EXPIRED: 0,
  };
  for (const row of rows) {
    counts[row.status] = Number(row.count);
    if (row.status !== "DELETED") counts.all += Number(row.count);
  }
  return counts;
}

export function getDashboardStats(db: DatabaseSync, workspaceId: string): DashboardStats {
  const row = db
    .prepare(
      `SELECT
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) AS drafts,
        SUM(CASE WHEN status = 'PENDING' AND EXISTS (SELECT 1 FROM recipients r WHERE r.document_id = documents.id AND r.opened_at IS NOT NULL) THEN 1 ELSE 0 END) AS viewed
       FROM documents WHERE workspace_id = ? AND status != 'DELETED'`,
    )
    .get(workspaceId) as {
    pending: number | null;
    completed: number | null;
    drafts: number | null;
    viewed: number | null;
  };
  return {
    pending: Number(row?.pending ?? 0),
    completed: Number(row?.completed ?? 0),
    drafts: Number(row?.drafts ?? 0),
    viewed: Number(row?.viewed ?? 0),
    documentsThisMonth: countDocumentsThisMonth(db, workspaceId),
  };
}

export interface DocumentDetail {
  document: DocumentRow;
  originalFile: DocumentFileRow | null;
  finalizedFile: DocumentFileRow | null;
  recipients: RecipientRow[];
  fields: FieldRow[];
  values: FieldValueRow[];
  creatorName: string;
  workspace: WorkspaceRowLite;
}

export function getDocumentDetail(
  db: DatabaseSync,
  workspaceId: string,
  documentId: string,
): DocumentDetail {
  const document = getDocument(db, documentId, workspaceId);
  if (!document) throw new NotFoundError("Document not found.");
  const workspace = getWorkspace(db, workspaceId);
  if (!workspace) throw new NotFoundError("Workspace not found.");
  const creator = db
    .prepare("SELECT full_name, email FROM users WHERE id = ?")
    .get(document.created_by) as { full_name: string; email: string } | undefined;
  const files = getDocumentFiles(db, documentId);
  return {
    document,
    originalFile: files.original,
    finalizedFile: files.finalized,
    recipients: getRecipients(db, documentId),
    fields: getFields(db, documentId),
    values: getFieldValues(db, documentId),
    creatorName: creator?.full_name || creator?.email || "A team member",
    workspace,
  };
}

export function getAuditForDocument(db: DatabaseSync, documentId: string): AuditEventRow[] {
  return getAuditEvents(db, documentId);
}

export type SigningViewState = "signing" | "finalizing" | "completed";

export interface SigningContext {
  recipient: RecipientRow;
  document: DocumentRow;
  workspace: { id: string; name: string; brand_display_name: string | null; brand_color: string | null };
  file: DocumentFileRow;
  finalizedFile: DocumentFileRow | null;
  senderName: string;
  fields: FieldRow[];
  values: FieldValueRow[];
  viewState: SigningViewState;
  progress: { required: number; completed: number };
}

export type SigningLookup =
  | { ok: true; context: SigningContext }
  | {
      ok: false;
      reason: "not_found" | "expired" | "voided" | "declined" | "revoked";
      documentTitle?: string;
    };

export function getSigningContext(db: DatabaseSync, rawToken: string): SigningLookup {
  const recipient = db
    .prepare("SELECT * FROM recipients WHERE token_hash = ?")
    .get(hashToken(rawToken)) as unknown as RecipientRow | undefined;
  if (!recipient) return { ok: false, reason: "not_found" };
  const document = getDocument(db, recipient.document_id);
  if (!document || document.status === "DELETED") return { ok: false, reason: "not_found" };

  if (
    document.status === "PENDING" &&
    document.expires_at &&
    new Date(document.expires_at).getTime() < Date.now()
  ) {
    expireStaleDocuments(db, document.workspace_id);
  }
  const refreshed = getDocument(db, document.id) as DocumentRow;
  if (refreshed.status === "EXPIRED") return { ok: false, reason: "expired" };
  if (refreshed.status === "VOIDED") return { ok: false, reason: "voided" };
  if (recipient.status === "DECLINED") return { ok: false, reason: "declined" };
  if (recipient.status === "REVOKED" || recipient.status === "EXPIRED") {
    return { ok: false, reason: "revoked" };
  }
  if (!["PENDING", "FINALIZING", "COMPLETED"].includes(refreshed.status)) {
    return { ok: false, reason: "not_found" };
  }
  if (refreshed.status === "PENDING" && recipient.token_expires_at) {
    if (new Date(recipient.token_expires_at).getTime() < Date.now()) {
      return { ok: false, reason: "expired" };
    }
  }
  const files = getDocumentFiles(db, document.id);
  if (!files.original) return { ok: false, reason: "not_found" };
  const workspace = getWorkspace(db, document.workspace_id);
  if (!workspace) return { ok: false, reason: "not_found" };
  const sender = db
    .prepare("SELECT full_name, email FROM users WHERE id = ?")
    .get(document.created_by) as { full_name: string; email: string } | undefined;
  const fields = db
    .prepare("SELECT * FROM fields WHERE document_id = ? AND recipient_id = ? ORDER BY page_index, created_at")
    .all(document.id, recipient.id) as unknown as FieldRow[];
  const values = db
    .prepare("SELECT * FROM field_values WHERE document_id = ? AND recipient_id = ?")
    .all(document.id, recipient.id) as unknown as FieldValueRow[];
  const progress = computeProgress(fields, values);
  const viewState: SigningViewState =
    refreshed.status === "COMPLETED"
      ? "completed"
      : refreshed.status === "FINALIZING"
        ? "finalizing"
        : "signing";
  return {
    ok: true,
    context: {
      recipient,
      document: refreshed,
      workspace,
      file: files.original,
      finalizedFile: files.finalized,
      senderName: sender?.full_name || workspace.brand_display_name || workspace.name,
      fields,
      values,
      viewState,
      progress,
    },
  };
}

export function markSignerOpened(
  db: DatabaseSync,
  rawToken: string,
  meta: { ip?: string | null; userAgent?: string | null },
): void {
  const lookup = getSigningContext(db, rawToken);
  if (!lookup.ok) return;
  const { recipient, document } = lookup.context;
  if (recipient.status !== "INVITED" || document.status !== "PENDING") return;
  const now = nowIso();
  db.prepare("UPDATE recipients SET status = 'OPENED', opened_at = ?, updated_at = ? WHERE id = ? AND status = 'INVITED'").run(
    now,
    now,
    recipient.id,
  );
  appendAuditEvent(db, {
    documentId: document.id,
    workspaceId: document.workspace_id,
    eventType: "recipient.opened",
    actorKind: "recipient",
    actorId: recipient.id,
    actorLabel: recipient.name || recipient.email,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { recipientId: recipient.id, email: recipient.email },
  });
}

export function recordConsent(
  db: DatabaseSync,
  rawToken: string,
  meta: { ip?: string | null; userAgent?: string | null },
): void {
  const lookup = getSigningContext(db, rawToken);
  if (!lookup.ok) throw new DomainError("This signing link is no longer valid.", "link_invalid", 410);
  const { recipient, document } = lookup.context;
  if (document.status !== "PENDING") throw new ConflictError("This document is no longer awaiting signatures.");
  if (recipient.status === "SIGNED") return;
  if (!["INVITED", "OPENED", "CONSENTED"].includes(recipient.status)) {
    throw new ConflictError("Consent cannot be recorded in the current state.");
  }
  const now = nowIso();
  if (recipient.status === "CONSENTED") return;
  db.prepare(
    "UPDATE recipients SET status = 'CONSENTED', consent_at = ?, consent_version = ?, updated_at = ? WHERE id = ?",
  ).run(now, CONSENT_VERSION, now, recipient.id);
  appendAuditEvent(db, {
    documentId: document.id,
    workspaceId: document.workspace_id,
    eventType: "consent.accepted",
    actorKind: "recipient",
    actorId: recipient.id,
    actorLabel: recipient.name || recipient.email,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: {
      recipientId: recipient.id,
      consentVersion: CONSENT_VERSION,
      disclosure: "Recipient agreed to conduct this transaction electronically.",
    },
  });
}

export function computeProgress(
  fields: FieldRow[],
  values: FieldValueRow[],
): { required: number; completed: number } {
  const required = fields.filter((field) => field.required === 1);
  let completed = 0;
  for (const field of required) {
    const value = values.find((item) => item.field_id === field.id);
    if (fieldIsComplete(field, value)) completed += 1;
  }
  return { required: required.length, completed };
}

export function fieldIsComplete(field: FieldRow, value: FieldValueRow | undefined): boolean {
  if (!value) return false;
  if (field.type === "signature" || field.type === "initials") {
    return Boolean(value.signature_asset_id);
  }
  if (field.type === "checkbox") {
    return value.checked === 1;
  }
  const text = (value.value_text || "").trim();
  if (!text) return false;
  if (field.type === "email" && !isValidEmail(text)) return false;
  return true;
}

export interface FieldSubmission {
  valueText?: string | null;
  checked?: boolean | null;
  signatureAssetId?: string | null;
  signatureMode?: string | null;
}

export function saveFieldValue(
  db: DatabaseSync,
  rawToken: string,
  fieldId: string,
  submission: FieldSubmission,
  meta: { ip?: string | null; userAgent?: string | null },
): { progress: { required: number; completed: number }; refreshed: FieldValueRow } {
  const lookup = getSigningContext(db, rawToken);
  if (!lookup.ok) throw new DomainError("This signing link is no longer valid.", "link_invalid", 410);
  const { recipient, document } = lookup.context;
  if (document.status !== "PENDING") throw new ConflictError("This document is no longer open for signing.");
  if (recipient.status === "SIGNED") throw new ConflictError("Your signature has already been recorded.");
  if (!["OPENED", "CONSENTED"].includes(recipient.status)) {
    throw new ConflictError("Please accept the electronic signing consent first.");
  }
  const field = db
    .prepare("SELECT * FROM fields WHERE id = ? AND document_id = ? AND recipient_id = ?")
    .get(fieldId, document.id, recipient.id) as unknown as FieldRow | undefined;
  if (!field) throw new NotFoundError("Field not found.");

  let valueText: string | null = null;
  let checked: number | null = null;
  let signatureAssetId: string | null = null;
  let signatureMode: string | null = null;

  if (field.type === "checkbox") {
    if (typeof submission.checked !== "boolean") {
      throw new ValidationError("A checkbox value must be true or false.");
    }
    checked = submission.checked ? 1 : 0;
  } else if (field.type === "signature" || field.type === "initials") {
    if (!submission.signatureAssetId) {
      throw new ValidationError("Adopt a signature before completing this field.");
    }
    const asset = db
      .prepare(
        "SELECT id, media_type FROM assets WHERE id = ? AND document_id = ? AND kind = 'signature'",
      )
      .get(submission.signatureAssetId, document.id) as
      | { id: string; media_type: string }
      | undefined;
    if (!asset || !["image/png", "image/jpeg"].includes(asset.media_type)) {
      throw new ValidationError("The signature image is invalid. Please add it again.");
    }
    signatureAssetId = asset.id;
    signatureMode = submission.signatureMode || "drawn";
  } else {
    const raw = (submission.valueText || "").trim();
    const max = field.type === "address" ? 500 : 200;
    if (raw.length > max) throw new ValidationError(`This value must be ${max} characters or fewer.`);
    if (field.type === "email" && raw && !isValidEmail(raw)) {
      throw new ValidationError("Enter a valid email address.");
    }
    valueText = raw;
  }

  const now = nowIso();
  const existing = db
    .prepare("SELECT * FROM field_values WHERE field_id = ?")
    .get(field.id) as unknown as FieldValueRow | undefined;
  if (existing) {
    db.prepare(
      `UPDATE field_values SET value_text = ?, checked = ?, signature_asset_id = ?, signature_mode = ?, updated_at = ? WHERE field_id = ?`,
    ).run(valueText, checked, signatureAssetId, signatureMode, now, field.id);
  } else {
    db.prepare(
      `INSERT INTO field_values
        (id, document_id, field_id, recipient_id, value_text, signature_asset_id, signature_mode, checked, recorded_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      newId("val"),
      document.id,
      field.id,
      recipient.id,
      valueText,
      signatureAssetId,
      signatureMode,
      checked,
      now,
      now,
    );
  }
  if (!existing) {
    appendAuditEvent(db, {
      documentId: document.id,
      workspaceId: document.workspace_id,
      eventType: "field.completed",
      actorKind: "recipient",
      actorId: recipient.id,
      actorLabel: recipient.name || recipient.email,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { recipientId: recipient.id, fieldId: field.id, fieldType: field.type },
    });
  }
  const fields = db
    .prepare("SELECT * FROM fields WHERE document_id = ? AND recipient_id = ?")
    .all(document.id, recipient.id) as unknown as FieldRow[];
  const values = db
    .prepare("SELECT * FROM field_values WHERE document_id = ? AND recipient_id = ?")
    .all(document.id, recipient.id) as unknown as FieldValueRow[];
  const refreshed = values.find((item) => item.field_id === field.id);
  return { progress: computeProgress(fields, values), refreshed: refreshed as FieldValueRow };
}

export async function saveSignatureAsset(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    documentId: string;
    recipientId: string;
    dataUrl: string;
  },
): Promise<{ assetId: string }> {
  const parsed = parseImageDataUrl(input.dataUrl);
  const saved = saveBuffer(input.workspaceId, parsed.buffer, parsed.extension);
  const id = newId("ast");
  db.prepare(
    `INSERT INTO assets (id, workspace_id, document_id, kind, storage_key, media_type, bytes, sha256, created_at)
     VALUES (?, ?, ?, 'signature', ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.workspaceId,
    input.documentId,
    saved.storageKey,
    parsed.mediaType,
    saved.bytes,
    saved.sha256,
    nowIso(),
  );
  return { assetId: id };
}

export interface CompleteSigningResult {
  alreadySigned: boolean;
  documentCompleted: boolean;
  finalizationPending: boolean;
  finalizationError?: string;
  progress: { required: number; completed: number };
}

export async function completeSigning(
  db: DatabaseSync,
  rawToken: string,
  meta: { ip?: string | null; userAgent?: string | null },
): Promise<CompleteSigningResult> {
  const lookup = getSigningContext(db, rawToken);
  if (!lookup.ok) throw new DomainError("This signing link is no longer valid.", "link_invalid", 410);
  const { recipient, document, fields, values } = lookup.context;
  if (recipient.status === "SIGNED") {
    return {
      alreadySigned: true,
      documentCompleted: document.status === "COMPLETED",
      finalizationPending: document.status === "FINALIZING",
      progress: computeProgress(fields, values),
    };
  }
  if (document.status !== "PENDING") throw new ConflictError("This document is no longer open for signing.");
  if (!["OPENED", "CONSENTED"].includes(recipient.status)) {
    throw new ConflictError("Please accept the electronic signing consent first.");
  }
  const progress = computeProgress(fields, values);
  if (progress.completed < progress.required) {
    const missing = fields
      .filter((field) => field.required === 1)
      .filter((field) => !fieldIsComplete(field, values.find((value) => value.field_id === field.id)))
      .map((field) => field.id);
    throw new ValidationError("Complete all required fields before submitting.", { missingFieldIds: missing });
  }
  const now = nowIso();
  let shouldFinalize = false;
  transaction(db, () => {
    const changed = db
      .prepare(
        "UPDATE recipients SET status = 'SIGNED', signed_at = ?, updated_at = ? WHERE id = ? AND status IN ('OPENED','CONSENTED')",
      )
      .run(now, now, recipient.id).changes;
    if (!changed) throw new ConflictError("This signature has already been recorded.");
    appendAuditEvent(db, {
      documentId: document.id,
      workspaceId: document.workspace_id,
      eventType: "recipient.signed",
      actorKind: "recipient",
      actorId: recipient.id,
      actorLabel: recipient.name || recipient.email,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: {
        recipientId: recipient.id,
        email: recipient.email,
        consentVersion: recipient.consent_version,
      },
    });
    const remaining = db
      .prepare(
        "SELECT COUNT(*) AS count FROM recipients WHERE document_id = ? AND role = 'signer' AND status != 'SIGNED'",
      )
      .get(document.id) as { count: number };
    if (Number(remaining.count) === 0) {
      const claimed = db
        .prepare(
          "UPDATE documents SET status = 'FINALIZING', updated_at = ? WHERE id = ? AND status = 'PENDING'",
        )
        .run(now, document.id).changes;
      if (claimed) {
        shouldFinalize = true;
        appendAuditEvent(db, {
          documentId: document.id,
          workspaceId: document.workspace_id,
          eventType: "document.finalizing",
          actorKind: "system",
          actorLabel: "SignFlow",
          metadata: {},
        });
      }
    }
  });

  if (!shouldFinalize) {
    return {
      alreadySigned: false,
      documentCompleted: false,
      finalizationPending: false,
      progress,
    };
  }
  try {
    await finalizeDocument(db, document.id);
    return {
      alreadySigned: false,
      documentCompleted: true,
      finalizationPending: false,
      progress,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Finalization failed.";
    appendAuditEvent(db, {
      documentId: document.id,
      workspaceId: document.workspace_id,
      eventType: "document.finalization_failed",
      actorKind: "system",
      actorLabel: "SignFlow",
      metadata: { error: message },
    });
    return {
      alreadySigned: false,
      documentCompleted: false,
      finalizationPending: true,
      finalizationError: message,
      progress,
    };
  }
}

const finalizingLocks = new Map<string, Promise<void>>();

export async function finalizeDocument(db: DatabaseSync, documentId: string): Promise<void> {
  const existingLock = finalizingLocks.get(documentId);
  if (existingLock) return existingLock;
  const promise = (async () => {
    const doc = getDocument(db, documentId);
    if (!doc) throw new NotFoundError("Document not found.");
    if (doc.status === "COMPLETED") return;
    if (!["PENDING", "FINALIZING"].includes(doc.status)) {
      throw new ConflictError("This document cannot be finalized in its current state.");
    }
    const recipients = getRecipients(db, documentId);
    const signers = recipients.filter((recipient) => recipient.role === "signer");
    if (!signers.length || signers.some((recipient) => recipient.status !== "SIGNED")) {
      throw new ConflictError("All recipients must sign before the document can be finalized.");
    }
    const files = getDocumentFiles(db, documentId);
    if (!files.original) throw new ConflictError("The original PDF is missing.");
    const fields = getFields(db, documentId);
    const values = getFieldValues(db, documentId);
    const finalizeFields: FieldForFinalization[] = [];
    for (const field of fields) {
      const value = values.find((item) => item.field_id === field.id);
      if (!value) continue;
      let signature: FinalizeSignature | null = null;
      if (value.signature_asset_id) {
        const asset = db
          .prepare("SELECT storage_key, media_type FROM assets WHERE id = ?")
          .get(value.signature_asset_id) as { storage_key: string; media_type: string } | undefined;
        if (asset) {
          try {
            signature = {
              bytes: readStoredObject(asset.storage_key),
              mediaType: asset.media_type,
            };
          } catch {
            throw new Error("A signature image could not be read. Please contact support.");
          }
        }
      }
      finalizeFields.push({
        pageIndex: field.page_index,
        type: field.type,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        valueText: value.value_text,
        checked: value.checked === 1,
        signature,
        fontSizeHint: field.font_size,
      });
    }
    const originalBytes = readStoredObject(files.original.storage_key);
    const completedBytes = await finalizePdf(originalBytes, finalizeFields);
    const completedHash = sha256Hex(Buffer.from(completedBytes));
    const saved = saveBuffer(doc.workspace_id, Buffer.from(completedBytes), "pdf");
    const now = nowIso();
    const fileId = newId("fil");
    transaction(db, () => {
      db.prepare(
        `INSERT INTO document_files
          (id, document_id, kind, original_filename, mime, bytes, sha256, storage_key, page_count, encrypted, created_at)
         VALUES (?, ?, 'finalized', ?, 'application/pdf', ?, ?, ?, ?, 0, ?)`,
      ).run(
        fileId,
        documentId,
        files.original!.original_filename.replace(/\.pdf$/i, "") + "-signed.pdf",
        saved.bytes,
        completedHash,
        saved.storageKey,
        files.original!.page_count,
        now,
      );
      db.prepare(
        "UPDATE documents SET status = 'COMPLETED', finalized_file_id = ?, completed_at = ?, updated_at = ? WHERE id = ?",
      ).run(fileId, now, now, documentId);
      appendAuditEvent(db, {
        documentId,
        workspaceId: doc.workspace_id,
        eventType: "document.finalized",
        actorKind: "system",
        actorLabel: "SignFlow",
        metadata: {
          completedSha256: completedHash,
          completedBytes: saved.bytes,
          fileId,
        },
      });
      appendAuditEvent(db, {
        documentId,
        workspaceId: doc.workspace_id,
        eventType: "document.completed",
        actorKind: "system",
        actorLabel: "SignFlow",
        metadata: { completedSha256: completedHash, recipients: signers.length },
      });
    });

    const sender = db
      .prepare("SELECT full_name, email FROM users WHERE id = ?")
      .get(doc.created_by) as { full_name: string; email: string } | undefined;
    const workspace = getWorkspace(db, doc.workspace_id);
    if (sender) {
      queueEmail(db, {
        kind: "signing_completed",
        to: sender.email,
        workspaceId: doc.workspace_id,
        documentId,
        subject: `Completed: ${doc.title}`,
        heading: "Every signature is in",
        intro: [
          `“${doc.title}” has been signed by all recipients and the completed PDF is ready.`,
          "The completed copy, original file and audit record are available in your workspace.",
        ],
        cta: { label: "View completed document", url: appLink(`/app/documents/${documentId}`) },
        meta: { completedSha256: completedHash },
      });
    }
    for (const recipient of signers) {
      queueEmail(db, {
        kind: "signing_completed",
        to: recipient.email,
        workspaceId: doc.workspace_id,
        documentId,
        recipientId: recipient.id,
        subject: `Signing complete: ${doc.title}`,
        heading: "Thank you — your signature is recorded",
        intro: [
          `All parties have completed “${doc.title}” on ${workspace?.brand_display_name || workspace?.name || "SignFlow"}.`,
          "You can return to the signing link at any time to view the completion confirmation.",
        ],
        footnote: "This message confirms completion. It is not a copy of the signed document.",
        meta: {},
      });
    }
  })();
  finalizingLocks.set(documentId, promise);
  try {
    await promise;
  } finally {
    finalizingLocks.delete(documentId);
  }
}

export async function voidDocument(
  db: DatabaseSync,
  input: {
    documentId: string;
    workspaceId: string;
    actor: { id: string; label: string };
    reason: string;
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<void> {
  const doc = getDocument(db, input.documentId, input.workspaceId);
  if (!doc) throw new NotFoundError("Document not found.");
  if (!["PENDING", "FINALIZING"].includes(doc.status)) {
    throw new ConflictError("Only a pending document can be voided.");
  }
  const reason = input.reason.trim();
  if (reason.length < 3) throw new ValidationError("Enter a reason for voiding this document.");
  if (reason.length > 500) throw new ValidationError("The reason must be 500 characters or fewer.");
  const now = nowIso();
  const pendingRecipients = getRecipients(db, doc.id).filter(
    (recipient) => recipient.status !== "SIGNED",
  );
  transaction(db, () => {
    db.prepare(
      "UPDATE documents SET status = 'VOIDED', void_reason = ?, voided_at = ?, updated_at = ? WHERE id = ?",
    ).run(reason, now, now, doc.id);
    db.prepare(
      "UPDATE recipients SET status = 'REVOKED', token_hash = NULL, token_expires_at = ?, updated_at = ? WHERE document_id = ? AND status != 'SIGNED'",
    ).run(now, now, doc.id);
    appendAuditEvent(db, {
      documentId: doc.id,
      workspaceId: doc.workspace_id,
      eventType: "document.voided",
      actorKind: "sender",
      actorId: input.actor.id,
      actorLabel: input.actor.label,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: { reason },
    });
  });
  for (const recipient of pendingRecipients) {
    queueEmail(db, {
      kind: "document_voided",
      to: recipient.email,
      workspaceId: doc.workspace_id,
      documentId: doc.id,
      recipientId: recipient.id,
      subject: `Signing request withdrawn: ${doc.title}`,
      heading: "This signing request has been withdrawn",
      intro: [
        `The sender has withdrawn the signing request for “${doc.title}”.`,
        "The signing link you received is no longer active. Please contact the sender if you have questions.",
      ],
      footnote: "No further action is required from you.",
      meta: {},
    });
  }
}

export async function declineSigning(
  db: DatabaseSync,
  rawToken: string,
  reason: string | null,
  meta: { ip?: string | null; userAgent?: string | null },
): Promise<void> {
  const lookup = getSigningContext(db, rawToken);
  if (!lookup.ok) throw new DomainError("This signing link is no longer valid.", "link_invalid", 410);
  const { recipient, document } = lookup.context;
  if (document.status !== "PENDING") throw new ConflictError("This document is no longer open for signing.");
  if (recipient.status === "SIGNED") throw new ConflictError("You have already signed this document.");
  const now = nowIso();
  const sender = db
    .prepare("SELECT full_name, email FROM users WHERE id = ?")
    .get(document.created_by) as { full_name: string; email: string } | undefined;
  transaction(db, () => {
    db.prepare(
      "UPDATE recipients SET status = 'DECLINED', declined_at = ?, updated_at = ? WHERE id = ?",
    ).run(now, now, recipient.id);
    db.prepare(
      "UPDATE recipients SET status = 'REVOKED', token_hash = NULL, token_expires_at = ?, updated_at = ? WHERE document_id = ? AND id != ? AND status != 'SIGNED'",
    ).run(now, now, document.id, recipient.id);
    db.prepare(
      "UPDATE documents SET status = 'VOIDED', void_reason = ?, voided_at = ?, updated_at = ? WHERE id = ?",
    ).run(`Declined by ${recipient.name || recipient.email}`, now, now, document.id);
    appendAuditEvent(db, {
      documentId: document.id,
      workspaceId: document.workspace_id,
      eventType: "recipient.declined",
      actorKind: "recipient",
      actorId: recipient.id,
      actorLabel: recipient.name || recipient.email,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { reason: reason ?? null },
    });
    appendAuditEvent(db, {
      documentId: document.id,
      workspaceId: document.workspace_id,
      eventType: "document.voided",
      actorKind: "system",
      actorLabel: "SignFlow",
      metadata: { reason: `Declined by ${recipient.name || recipient.email}` },
    });
  });
  if (sender) {
    queueEmail(db, {
      kind: "signing_declined",
      to: sender.email,
      workspaceId: document.workspace_id,
      documentId: document.id,
      subject: `Declined: ${document.title}`,
      heading: "A recipient declined to sign",
      intro: [
        `${recipient.name || recipient.email} declined to sign “${document.title}”.`,
        "The request has been voided and all outstanding signing links have been revoked.",
      ],
      cta: { label: "View document", url: appLink(`/app/documents/${document.id}`) },
      footnote: reason ? `Reason provided: ${reason}` : undefined,
      meta: { recipientId: recipient.id },
    });
  }
}

export async function remindRecipient(
  db: DatabaseSync,
  input: {
    documentId: string;
    workspaceId: string;
    recipientId: string;
    actor: { id: string; label: string };
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<{ link: string; expiresAt: string }> {
  const doc = getDocument(db, input.documentId, input.workspaceId);
  if (!doc) throw new NotFoundError("Document not found.");
  if (doc.status !== "PENDING") throw new ConflictError("Only a pending document can be reminded.");
  const recipient = db
    .prepare("SELECT * FROM recipients WHERE id = ? AND document_id = ?")
    .get(input.recipientId, doc.id) as unknown as RecipientRow | undefined;
  if (!recipient) throw new NotFoundError("Recipient not found.");
  if (["SIGNED", "DECLINED", "REVOKED", "EXPIRED"].includes(recipient.status)) {
    throw new ConflictError("This recipient no longer needs a reminder.");
  }
  const workspace = getWorkspace(db, doc.workspace_id);
  const token = newToken(32);
  const expiresAt = doc.expires_at || addDaysIso(env.signingLinkTtlDays);
  const now = nowIso();
  db.prepare("UPDATE recipients SET token_hash = ?, token_expires_at = ?, updated_at = ? WHERE id = ?").run(
    hashToken(token),
    expiresAt,
    now,
    recipient.id,
  );
  appendAuditEvent(db, {
    documentId: doc.id,
    workspaceId: doc.workspace_id,
    eventType: "document.reminded",
    actorKind: "sender",
    actorId: input.actor.id,
    actorLabel: input.actor.label,
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: { recipientId: recipient.id, email: recipient.email },
  });
  const link = appLink(`/sign/${token}`);
  queueEmail(db, {
    kind: "signing_reminder",
    to: recipient.email,
    workspaceId: doc.workspace_id,
    documentId: doc.id,
    recipientId: recipient.id,
    subject: `Reminder: “${doc.title}” is awaiting your signature`,
    heading: "Your signature is still needed",
    intro: [
      `${input.actor.label} has sent a reminder for “${doc.title}”.`,
      `This fresh signing link expires on ${new Date(expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`,
    ],
    cta: { label: "Review and sign", url: link },
    footnote:
      "For security, this reminder replaces any earlier signing link. The most recent email is the one to use.",
    meta: { link },
  });
  return { link, expiresAt };
}

export function deleteDraftDocument(
  db: DatabaseSync,
  input: {
    documentId: string;
    workspaceId: string;
    actor: { id: string; label: string };
  },
): void {
  const doc = getDocument(db, input.documentId, input.workspaceId);
  if (!doc) throw new NotFoundError("Document not found.");
  if (doc.status !== "DRAFT") throw new ConflictError("Only drafts can be deleted.");
  const now = nowIso();
  db.prepare("UPDATE documents SET status = 'DELETED', updated_at = ? WHERE id = ?").run(now, doc.id);
  appendAuditEvent(db, {
    documentId: doc.id,
    workspaceId: doc.workspace_id,
    eventType: "document.deleted",
    actorKind: "sender",
    actorId: input.actor.id,
    actorLabel: input.actor.label,
    metadata: {},
  });
}

export interface CompletedDocumentData {
  document: DocumentRow;
  originalFile: DocumentFileRow;
  finalizedFile: DocumentFileRow;
  recipients: RecipientRow[];
  events: AuditEventRow[];
  auditValid: boolean;
}

export function getCompletedDocumentData(
  db: DatabaseSync,
  documentId: string,
): CompletedDocumentData {
  const document = getDocument(db, documentId);
  if (!document) throw new NotFoundError("Document not found.");
  const files = getDocumentFiles(db, documentId);
  if (!files.original || !files.finalized) {
    throw new ConflictError("The completed document files are not available.");
  }
  return {
    document,
    originalFile: files.original,
    finalizedFile: files.finalized,
    recipients: getRecipients(db, documentId),
    events: getAuditEvents(db, documentId),
    auditValid: verifyAuditChain(db, documentId).valid,
  };
}

export function assertWorkspaceDocument(
  db: DatabaseSync,
  workspaceId: string,
  documentId: string,
): DocumentRow {
  const doc = getDocument(db, documentId, workspaceId);
  if (!doc) throw new NotFoundError("Document not found.");
  return doc;
}

export function ensureDocumentAccess(
  role: string,
  doc: DocumentRow,
  userId: string,
  action: "edit" | "send" | "delete" | "view",
): void {
  if (["owner", "admin"].includes(role)) return;
  if (action === "view") return;
  if (doc.created_by !== userId) {
    throw new PermissionError("Only the document owner or a workspace admin can perform this action.");
  }
}

export function pdfMediaType(storageKey: string): string {
  return mediaTypeForKey(storageKey);
}

export function hashCompletedPdfForTest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
