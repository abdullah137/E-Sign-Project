import { createHmac, randomInt } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { addDaysIso, addMinutesIso, hashToken, newId, newToken, nowIso, normalizeEmail, safeEqual, sha256Hex } from "./ids";
import { appLink, queueEmail } from "./email";
import { appendAuditEvent } from "./audit";
import { transaction } from "./db";
import { getDocument, getDocumentFiles, getFields, getRecipients, sendDocument, startOfMonthIso } from "./documents";
import { copyStoredObject } from "./storage";
import { getPlan } from "./plans";
import { isValidEmail, type FieldType } from "./field-types";
import { ConflictError, NotFoundError, ValidationError } from "./errors";

export interface TemplateFieldBlueprint {
  slot: number;
  pageIndex: number;
  type: FieldType;
  label: string | null;
  required: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fontSize: number | null;
  options: unknown;
}

export interface TemplateRecipientSlot {
  index: number;
  name: string;
  role: string;
  signingOrder: number;
}

export interface TemplateRow {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  description: string | null;
  status: string;
  source_filename: string;
  source_storage_key: string;
  source_sha256: string;
  page_count: number;
  field_blueprints_json: string;
  recipient_slots_json: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  status: string;
  sourceFilename: string;
  pageCount: number;
  fieldCount: number;
  recipientSlots: TemplateRecipientSlot[];
  publicLinkCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function parseBlueprints(row: TemplateRow): TemplateFieldBlueprint[] {
  try {
    const parsed = JSON.parse(row.field_blueprints_json) as TemplateFieldBlueprint[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseSlots(row: TemplateRow): TemplateRecipientSlot[] {
  try {
    const parsed = JSON.parse(row.recipient_slots_json) as TemplateRecipientSlot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getTemplate(
  db: DatabaseSync,
  workspaceId: string,
  templateId: string,
): TemplateRow | undefined {
  return db
    .prepare("SELECT * FROM templates WHERE id = ? AND workspace_id = ?")
    .get(templateId, workspaceId) as unknown as TemplateRow | undefined;
}

export function listTemplates(db: DatabaseSync, workspaceId: string): TemplateSummary[] {
  const rows = db
    .prepare(
      `SELECT t.*,
        (SELECT COUNT(*) FROM public_links p WHERE p.template_id = t.id AND p.status = 'active') AS public_link_count
       FROM templates t
       WHERE t.workspace_id = ? AND t.status = 'active'
       ORDER BY t.updated_at DESC`,
    )
    .all(workspaceId) as unknown as Array<TemplateRow & { public_link_count: number }>;
  return rows.map((row) => {
    const blueprints = parseBlueprints(row);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      sourceFilename: row.source_filename,
      pageCount: row.page_count,
      fieldCount: blueprints.length,
      recipientSlots: parseSlots(row),
      publicLinkCount: Number(row.public_link_count),
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export function createTemplateFromDocument(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    userId: string;
    documentId: string;
    name?: string;
    description?: string | null;
  },
): TemplateRow {
  const doc = getDocument(db, input.documentId, input.workspaceId);
  if (!doc) throw new NotFoundError("Document not found.");
  if (doc.status === "DELETED") throw new ConflictError("Deleted documents cannot become templates.");
  const file = getDocumentFiles(db, doc.id).original;
  if (!file) throw new NotFoundError("The source PDF is missing.");
  const recipients = getRecipients(db, doc.id);
  const fields = getFields(db, doc.id);
  if (!recipients.length) throw new ValidationError("Add recipients before saving this document as a template.");
  if (!fields.length) throw new ValidationError("Place at least one field before saving a template.");

  const name = (input.name?.trim() || doc.title).slice(0, 80);
  if (name.length < 2) throw new ValidationError("Give the template a name.");
  const description = input.description?.trim() || null;
  if (description && description.length > 280) {
    throw new ValidationError("The description must be 280 characters or fewer.");
  }

  const slots: TemplateRecipientSlot[] = recipients.map((recipient, index) => ({
    index,
    name: recipient.name,
    role: recipient.role,
    signingOrder: recipient.signing_order,
  }));
  const slotByRecipient = new Map(recipients.map((recipient, index) => [recipient.id, index]));
  const blueprints: TemplateFieldBlueprint[] = fields.map((field) => ({
    slot: slotByRecipient.get(field.recipient_id) ?? 0,
    pageIndex: field.page_index,
    type: field.type,
    label: field.label,
    required: field.required === 1,
    x: field.x,
    y: field.y,
    width: field.width,
    height: field.height,
    rotation: field.rotation,
    fontSize: field.font_size,
    options: field.options_json ? (JSON.parse(field.options_json) as unknown) : null,
  }));

  const id = newId("tpl");
  const now = nowIso();
  const saved = copyStoredObject(file.storage_key, input.workspaceId);
  db.prepare(
    `INSERT INTO templates
      (id, workspace_id, created_by, name, description, status, source_filename, source_storage_key,
       source_sha256, page_count, field_blueprints_json, recipient_slots_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.workspaceId,
    input.userId,
    name,
    description,
    file.original_filename,
    saved.storageKey,
    saved.sha256,
    file.page_count,
    JSON.stringify(blueprints),
    JSON.stringify(slots),
    now,
    now,
  );
  return getTemplate(db, input.workspaceId, id) as TemplateRow;
}

export function archiveTemplate(
  db: DatabaseSync,
  workspaceId: string,
  templateId: string,
): void {
  const template = getTemplate(db, workspaceId, templateId);
  if (!template) throw new NotFoundError("Template not found.");
  const links = db
    .prepare("SELECT COUNT(*) AS count FROM public_links WHERE template_id = ? AND status = 'active'")
    .get(templateId) as { count: number };
  if (Number(links.count) > 0) {
    throw new ConflictError("Revoke this template's public links before deleting it.");
  }
  db.prepare("UPDATE templates SET status = 'archived', updated_at = ? WHERE id = ?").run(
    nowIso(),
    templateId,
  );
}

export function assertDocumentQuota(db: DatabaseSync, workspaceId: string): void {
  const workspace = db.prepare("SELECT plan FROM workspaces WHERE id = ?").get(workspaceId) as
    | { plan: string }
    | undefined;
  if (!workspace) throw new NotFoundError("Workspace not found.");
  const plan = getPlan(workspace.plan);
  const row = db
    .prepare(
      "SELECT COUNT(*) AS count FROM documents WHERE workspace_id = ? AND status != 'DELETED' AND created_at >= ?",
    )
    .get(workspaceId, startOfMonthIso()) as { count: number };
  if (Number(row.count) >= plan.documentsPerMonth) {
    throw new ConflictError(
      `This workspace has reached the ${plan.documentsPerMonth}-document monthly limit on the ${plan.name} plan.`,
    );
  }
}

export function createDocumentFromTemplate(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    userId: string;
    userLabel: string;
    templateId: string;
    title?: string;
    recipients: Array<{ name: string; email: string }>;
    ip?: string | null;
    userAgent?: string | null;
    auditLabel?: string;
  },
): { documentId: string } {
  const template = getTemplate(db, input.workspaceId, input.templateId);
  if (!template || template.status !== "active") throw new NotFoundError("Template not found.");
  const slots = parseSlots(template);
  if (!slots.length) throw new ConflictError("This template has no recipient slots.");
  if (input.recipients.length !== slots.length) {
    throw new ValidationError(`This template needs ${slots.length} recipient${slots.length === 1 ? "" : "s"}.`);
  }
  const normalized = new Set<string>();
  const recipients = input.recipients.map((recipient, index) => {
    const email = recipient.email.trim();
    if (!isValidEmail(email)) {
      throw new ValidationError(`Enter a valid email for recipient ${index + 1}.`);
    }
    const key = normalizeEmail(email);
    if (normalized.has(key)) throw new ValidationError("Each recipient needs a unique email address.");
    normalized.add(key);
    const fallback = slots[index]?.name?.trim() || email.split("@")[0];
    return {
      name: recipient.name.trim() || fallback,
      email,
      emailNormalized: key,
      signingOrder: slots[index]?.signingOrder ?? index + 1,
    };
  });

  assertDocumentQuota(db, input.workspaceId);

  const documentId = newId("doc");
  const fileId = newId("fil");
  const saved = copyStoredObject(template.source_storage_key, input.workspaceId);
  const now = nowIso();
  const title = (input.title?.trim() || template.name).slice(0, 160);
  const blueprints = parseBlueprints(template);

  transaction(db, () => {
    db.prepare(
      `INSERT INTO documents (id, workspace_id, created_by, title, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'DRAFT', ?, ?)`,
    ).run(documentId, input.workspaceId, input.userId, title, now, now);
    db.prepare(
      `INSERT INTO document_files
        (id, document_id, kind, original_filename, mime, bytes, sha256, storage_key, page_count, encrypted, created_at)
       VALUES (?, ?, 'original', ?, 'application/pdf', ?, ?, ?, ?, 0, ?)`,
    ).run(
      fileId,
      documentId,
      template.source_filename,
      saved.bytes,
      saved.sha256,
      saved.storageKey,
      template.page_count,
      now,
    );
    db.prepare("UPDATE documents SET original_file_id = ? WHERE id = ?").run(fileId, documentId);

    const recipientIds: string[] = [];
    recipients.forEach((recipient) => {
      const id = newId("rcp");
      recipientIds.push(id);
      db.prepare(
        `INSERT INTO recipients
          (id, document_id, name, email, email_normalized, role, signing_order, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'signer', ?, 'PENDING', ?, ?)`,
      ).run(
        id,
        documentId,
        recipient.name,
        recipient.email,
        recipient.emailNormalized,
        recipient.signingOrder,
        now,
        now,
      );
    });

    for (const blueprint of blueprints) {
      const recipientId = recipientIds[blueprint.slot] ?? recipientIds[0];
      if (!recipientId) continue;
      db.prepare(
        `INSERT INTO fields
          (id, document_id, page_index, type, label, recipient_id, required, x, y, width, height, rotation,
           font_size, options_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        newId("fld"),
        documentId,
        blueprint.pageIndex,
        blueprint.type,
        blueprint.label,
        recipientId,
        blueprint.required ? 1 : 0,
        blueprint.x,
        blueprint.y,
        blueprint.width,
        blueprint.height,
        blueprint.rotation,
        blueprint.fontSize,
        blueprint.options ? JSON.stringify(blueprint.options) : null,
        now,
        now,
      );
    }

    appendAuditEvent(db, {
      documentId,
      workspaceId: input.workspaceId,
      eventType: "document.created_from_template",
      actorKind: "sender",
      actorId: input.userId,
      actorLabel: input.auditLabel ?? input.userLabel,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: { templateId: template.id, templateName: template.name },
    });
  });

  return { documentId };
}

/* ------------------------------------------------------------------ */
/* Public links                                                        */
/* ------------------------------------------------------------------ */

export interface PublicLinkRow {
  id: string;
  workspace_id: string;
  template_id: string;
  name: string;
  token_hash: string;
  status: string;
  otp_required: number;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
}

export interface PublicLinkSummary {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  status: string;
  expired: boolean;
  expiresAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  url: string;
  uses: number;
}

function publicLinkSecret(db: DatabaseSync): string {
  const row = db.prepare("SELECT value FROM app_meta WHERE key = 'public_link_secret'").get() as
    | { value: string }
    | undefined;
  if (row) return row.value;
  const value = newToken(32);
  db.prepare("INSERT OR IGNORE INTO app_meta (key, value) VALUES ('public_link_secret', ?)").run(value);
  const stored = db.prepare("SELECT value FROM app_meta WHERE key = 'public_link_secret'").get() as {
    value: string;
  };
  return stored.value;
}

export function publicLinkToken(db: DatabaseSync, linkId: string): string {
  const signature = createHmac("sha256", publicLinkSecret(db))
    .update(`public-link:${linkId}`)
    .digest("base64url");
  return `${linkId}.${signature}`;
}

export function publicLinkUrl(db: DatabaseSync, linkId: string): string {
  return appLink(`/p/${publicLinkToken(db, linkId)}`);
}

function expired(link: { expires_at: string | null }): boolean {
  return Boolean(link.expires_at && new Date(link.expires_at).getTime() < Date.now());
}

export function listPublicLinks(db: DatabaseSync, workspaceId: string): PublicLinkSummary[] {
  const rows = db
    .prepare(
      `SELECT l.*, t.name AS template_name,
        (SELECT COUNT(*) FROM public_link_otps o WHERE o.link_id = l.id AND o.consumed_at IS NOT NULL) AS uses
       FROM public_links l
       JOIN templates t ON t.id = l.template_id
       WHERE l.workspace_id = ?
       ORDER BY l.created_at DESC`,
    )
    .all(workspaceId) as unknown as Array<
    PublicLinkRow & { template_name: string; uses: number }
  >;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    templateId: row.template_id,
    templateName: row.template_name,
    status: row.status,
    expired: expired(row),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    url: publicLinkUrl(db, row.id),
    uses: Number(row.uses),
  }));
}

export function createPublicLink(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    templateId: string;
    name: string;
    expiresInDays?: number;
    otpRequired?: boolean;
  },
): PublicLinkSummary {
  const template = getTemplate(db, input.workspaceId, input.templateId);
  if (!template || template.status !== "active") throw new NotFoundError("Template not found.");
  const slots = parseSlots(template);
  if (slots.length !== 1) {
    throw new ValidationError(
      "Public links are available for templates with exactly one recipient. Multi-party templates must be prepared manually.",
    );
  }
  const name = input.name.trim();
  if (name.length < 2) throw new ValidationError("Give this link a name.");
  if (name.length > 80) throw new ValidationError("The name must be 80 characters or fewer.");
  const days = Math.min(90, Math.max(1, Math.round(input.expiresInDays ?? 30)));
  const id = newId("lnk");
  const token = publicLinkToken(db, id);
  const now = nowIso();
  db.prepare(
    `INSERT INTO public_links
      (id, workspace_id, template_id, name, token_hash, status, otp_required, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
  ).run(
    id,
    input.workspaceId,
    template.id,
    name,
    hashToken(token),
    input.otpRequired === false ? 0 : 1,
    addDaysIso(days),
    now,
  );
  return {
    id,
    name,
    templateId: template.id,
    templateName: template.name,
    status: "active",
    expired: false,
    expiresAt: addDaysIso(days),
    createdAt: now,
    lastUsedAt: null,
    url: publicLinkUrl(db, id),
    uses: 0,
  };
}

export function revokePublicLink(db: DatabaseSync, workspaceId: string, linkId: string): void {
  const changed = db
    .prepare(
      "UPDATE public_links SET status = 'revoked' WHERE id = ? AND workspace_id = ? AND status = 'active'",
    )
    .run(linkId, workspaceId).changes;
  if (!changed) throw new ConflictError("That link is already revoked or was not found.");
}

export type PublicLinkLookup =
  | {
      ok: true;
      link: PublicLinkRow;
      template: TemplateRow;
      workspace: {
        id: string;
        name: string;
        owner_id: string;
        brand_display_name: string | null;
        brand_color: string | null;
      };
      slotCount: number;
      fieldCount: number;
    }
  | { ok: false; reason: "invalid" | "revoked" | "expired" | "unavailable" };

export function getPublicLinkContext(db: DatabaseSync, rawToken: string): PublicLinkLookup {
  if (!rawToken || rawToken.length < 20 || rawToken.length > 400) {
    return { ok: false, reason: "invalid" };
  }
  const row = db
    .prepare("SELECT * FROM public_links WHERE token_hash = ?")
    .get(hashToken(rawToken)) as unknown as PublicLinkRow | undefined;
  if (!row) return { ok: false, reason: "invalid" };
  if (row.status !== "active") return { ok: false, reason: "revoked" };
  if (expired(row)) return { ok: false, reason: "expired" };
  const template = db
    .prepare("SELECT * FROM templates WHERE id = ? AND workspace_id = ?")
    .get(row.template_id, row.workspace_id) as unknown as TemplateRow | undefined;
  if (!template || template.status !== "active") return { ok: false, reason: "unavailable" };
  const workspace = db
    .prepare("SELECT id, name, owner_id, brand_display_name, brand_color FROM workspaces WHERE id = ?")
    .get(row.workspace_id) as
    | {
        id: string;
        name: string;
        owner_id: string;
        brand_display_name: string | null;
        brand_color: string | null;
      }
    | undefined;
  if (!workspace) return { ok: false, reason: "invalid" };
  return {
    ok: true,
    link: row,
    template,
    workspace,
    slotCount: parseSlots(template).length,
    fieldCount: parseBlueprints(template).length,
  };
}

export function requestPublicLinkOtp(
  db: DatabaseSync,
  link: PublicLinkRow,
  email: string,
): { expiresAt: string; code: string } {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) throw new ValidationError("Enter a valid email address.");
  const now = nowIso();
  db.prepare(
    "UPDATE public_link_otps SET consumed_at = ? WHERE link_id = ? AND email_normalized = ? AND consumed_at IS NULL",
  ).run(now, link.id, normalized);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = addMinutesIso(10);
  db.prepare(
    `INSERT INTO public_link_otps
      (id, link_id, email_normalized, code_hash, attempts, expires_at, created_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
  ).run(
    newId("otp"),
    link.id,
    normalized,
    sha256Hex(`public-otp:${link.id}:${code}`),
    expiresAt,
    now,
  );
  return { expiresAt, code };
}

export async function redeemPublicLink(
  db: DatabaseSync,
  input: {
    rawToken: string;
    name: string;
    email: string;
    code: string;
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<{ documentId: string; signingUrl: string }> {
  const lookup = getPublicLinkContext(db, input.rawToken);
  if (!lookup.ok) throw new ValidationError("This public link is no longer available.");
  const { link, template, workspace } = lookup;
  const email = input.email.trim();
  if (!isValidEmail(email)) throw new ValidationError("Enter a valid email address.");
  const name = input.name.trim();
  if (name.length < 2) throw new ValidationError("Enter your full name.");
  if (name.length > 120) throw new ValidationError("The name must be 120 characters or fewer.");
  const normalized = normalizeEmail(email);

  assertDocumentQuota(db, link.workspace_id);

  const otp = db
    .prepare(
      `SELECT * FROM public_link_otps
       WHERE link_id = ? AND email_normalized = ? AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(link.id, normalized) as
    | {
        id: string;
        code_hash: string;
        attempts: number;
        expires_at: string;
      }
    | undefined;
  if (!otp) throw new ValidationError("Request a new verification code to continue.");
  if (new Date(otp.expires_at).getTime() < Date.now()) {
    throw new ValidationError("That code has expired. Request a new one.");
  }
  if (otp.attempts >= 5) {
    throw new ValidationError("Too many attempts. Request a new verification code.");
  }
  const expected = sha256Hex(`public-otp:${link.id}:${input.code.trim()}`);
  if (!safeEqual(expected, otp.code_hash)) {
    db.prepare("UPDATE public_link_otps SET attempts = attempts + 1 WHERE id = ?").run(otp.id);
    throw new ValidationError("That verification code is not correct.");
  }
  const consumed = db
    .prepare("UPDATE public_link_otps SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL")
    .run(nowIso(), otp.id).changes;
  if (!consumed) throw new ConflictError("This code has already been used. Request a new one.");
  db.prepare("UPDATE public_links SET last_used_at = ? WHERE id = ?").run(nowIso(), link.id);

  const workspaceName = workspace.brand_display_name || workspace.name;
  const created = createDocumentFromTemplate(db, {
    workspaceId: link.workspace_id,
    userId: workspace.owner_id,
    userLabel: "Public link",
    templateId: template.id,
    title: template.name,
    recipients: [{ name, email }],
    ip: input.ip,
    userAgent: input.userAgent,
    auditLabel: `${name} via ${link.name}`,
  });

  const sent = await sendDocument(db, {
    documentId: created.documentId,
    workspaceId: link.workspace_id,
    actor: { id: "public_link", label: `${workspaceName} public link`, email: normalized },
    ip: input.ip,
    userAgent: input.userAgent,
  });

  appendAuditEvent(db, {
    documentId: created.documentId,
    workspaceId: link.workspace_id,
    eventType: "public_link.used",
    actorKind: "public",
    actorId: link.id,
    actorLabel: normalized,
    ip: input.ip,
    userAgent: input.userAgent,
    metadata: { linkId: link.id, linkName: link.name, templateId: template.id },
  });

  return {
    documentId: created.documentId,
    signingUrl: sent.links[0]?.link ?? appLink(`/sign`),
  };
}

export function queuePublicOtpEmail(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    linkName: string;
    workspaceName: string;
    templateName: string;
    email: string;
    code: string;
    expiresAt: string;
  },
): void {
  queueEmail(db, {
    kind: "public_link_otp",
    to: input.email,
    workspaceId: input.workspaceId,
    subject: `Your verification code for ${input.linkName}`,
    heading: "Verify your email",
    intro: [
      `${input.workspaceName} asked you to confirm your email before continuing with “${input.templateName}”.`,
      `Your verification code is ${input.code}. It expires in 10 minutes and can be used once.`,
    ],
    footnote: "If you did not request this code, ignore this email. Nothing was created.",
    meta: { linkName: input.linkName, expiresAt: input.expiresAt },
  });
}
