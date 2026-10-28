import type { DatabaseSync } from "node:sqlite";
import { createDatabase } from "@/lib/db";
import { addDaysIso, hashToken, nowIso } from "@/lib/ids";

export interface Fixture {
  db: DatabaseSync;
  userId: string;
  workspaceId: string;
  documentId: string;
  recipientId: string;
  fieldId: string;
}

export function makeDb(): DatabaseSync {
  return createDatabase(":memory:");
}

export function seedWorkspace(db: DatabaseSync, plan = "pro"): { userId: string; workspaceId: string } {
  const now = nowIso();
  const userId = "usr_owner";
  const workspaceId = "ws_test";
  db.prepare(
    `INSERT INTO users (id, full_name, email, email_normalized, password_hash, email_verified_at, created_at, updated_at)
     VALUES (?, 'Dana Owner', 'dana@example.com', 'dana@example.com', 'scrypt$test', ?, ?, ?)`,
  ).run(userId, now, now, now);
  db.prepare(
    `INSERT INTO workspaces (id, name, owner_id, plan, brand_display_name, brand_color, created_at)
     VALUES (?, 'Test Workspace', ?, ?, 'Test Workspace', '#B89558', ?)`,
  ).run(workspaceId, userId, plan, now);
  db.prepare(
    `INSERT INTO memberships (id, workspace_id, user_id, role, status, created_at)
     VALUES ('mem_owner', ?, ?, 'owner', 'active', ?)`,
  ).run(workspaceId, userId, now);
  return { userId, workspaceId };
}

export function addDocument(
  db: DatabaseSync,
  workspaceId: string,
  input: {
    id?: string;
    userId?: string;
    status?: string;
    createdAt?: string;
    expiresAt?: string | null;
  } = {},
): string {
  const id = input.id ?? "doc_test";
  const now = nowIso();
  db.prepare(
    `INSERT INTO documents (id, workspace_id, created_by, title, status, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, 'Test agreement', ?, ?, ?, ?)`,
  ).run(
    id,
    workspaceId,
    input.userId ?? "usr_owner",
    input.status ?? "DRAFT",
    input.expiresAt ?? null,
    input.createdAt ?? now,
    now,
  );
  db.prepare(
    `INSERT INTO document_files
      (id, document_id, kind, original_filename, mime, bytes, sha256, storage_key, page_count, encrypted, created_at)
     VALUES (?, ?, 'original', 'test.pdf', 'application/pdf', 512, ?, ?, 1, 0, ?)`,
  ).run(`fil_${id}`, id, "a".repeat(64), `${workspaceId}/test.pdf`, now);
  return id;
}

export function addRecipient(
  db: DatabaseSync,
  documentId: string,
  input: {
    id?: string;
    name?: string;
    email?: string;
    status?: string;
    token?: string | null;
    tokenExpiresAt?: string | null;
  } = {},
): string {
  const now = nowIso();
  const id = input.id ?? `rcp_${documentId}`;
  const email = input.email ?? "signer@example.com";
  db.prepare(
    `INSERT INTO recipients
      (id, document_id, name, email, email_normalized, role, signing_order, status, token_hash, token_expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'signer', 1, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    documentId,
    input.name ?? "Sam Signer",
    email,
    email.toLowerCase(),
    input.status ?? "INVITED",
    input.token ? hashToken(input.token) : null,
    input.tokenExpiresAt ?? null,
    now,
    now,
  );
  return id;
}

export function addField(
  db: DatabaseSync,
  documentId: string,
  recipientId: string,
  input: {
    id?: string;
    type?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  } = {},
): string {
  const now = nowIso();
  const id = input.id ?? `fld_${documentId}`;
  db.prepare(
    `INSERT INTO fields
      (id, document_id, page_index, type, label, recipient_id, required, x, y, width, height, rotation, created_at, updated_at)
     VALUES (?, ?, 0, ?, 'Signature', ?, 1, ?, ?, ?, ?, 0, ?, ?)`,
  ).run(
    id,
    documentId,
    input.type ?? "signature",
    recipientId,
    input.x ?? 0.1,
    input.y ?? 0.1,
    input.width ?? 0.2,
    input.height ?? 0.05,
    now,
    now,
  );
  return id;
}

export function seedSigningDocument(
  db: DatabaseSync,
  workspaceId: string,
  options: { token: string; docStatus?: string; tokenExpiresAt?: string | null } = {
    token: "raw-token",
  },
): { documentId: string; recipientId: string } {
  const documentId = addDocument(db, workspaceId, {
    status: options.docStatus ?? "PENDING",
    expiresAt: addDaysIso(7),
  });
  const recipientId = addRecipient(db, documentId, {
    token: options.token,
    tokenExpiresAt: options.tokenExpiresAt ?? addDaysIso(7),
  });
  addField(db, documentId, recipientId);
  return { documentId, recipientId };
}

export function addTemplate(
  db: DatabaseSync,
  workspaceId: string,
  input: {
    id?: string;
    slots?: number;
    fields?: Array<{ slot: number; type?: string; required?: boolean }>;
  } = {},
): string {
  const now = nowIso();
  const id = input.id ?? "tpl_test";
  const slotCount = input.slots ?? 1;
  const blueprints = (input.fields ?? [{ slot: 0 }]).map((field, index) => ({
    slot: field.slot,
    pageIndex: 0,
    type: field.type ?? "signature",
    label: `Field ${index + 1}`,
    required: field.required ?? true,
    x: 0.1 + index * 0.02,
    y: 0.1,
    width: 0.2,
    height: 0.05,
    rotation: 0,
    fontSize: null,
    options: null,
  }));
  const slots = Array.from({ length: slotCount }, (_, index) => ({
    index,
    name: `Signer ${index + 1}`,
    role: "signer",
    signingOrder: index + 1,
  }));
  db.prepare(
    `INSERT INTO templates
      (id, workspace_id, created_by, name, description, status, source_filename, source_storage_key,
       source_sha256, page_count, field_blueprints_json, recipient_slots_json, created_at, updated_at)
     VALUES (?, ?, 'usr_owner', 'Template', 'Test template', 'active', 'source.pdf', 'ws_source/source.pdf',
       ?, 1, ?, ?, ?, ?)`,
  ).run(id, workspaceId, "b".repeat(64), JSON.stringify(blueprints), JSON.stringify(slots), now, now);
  return id;
}

export function addPublicLink(
  db: DatabaseSync,
  workspaceId: string,
  templateId: string,
  token: string,
  input: { id?: string; status?: string; expiresAt?: string | null } = {},
): string {
  const now = nowIso();
  const id = input.id ?? "lnk_test";
  db.prepare(
    `INSERT INTO public_links
      (id, workspace_id, template_id, name, token_hash, status, otp_required, expires_at, created_at)
     VALUES (?, ?, ?, 'Public request', ?, ?, 1, ?, ?)`,
  ).run(
    id,
    workspaceId,
    templateId,
    hashToken(token),
    input.status ?? "active",
    input.expiresAt === undefined ? addDaysIso(30) : input.expiresAt,
    now,
  );
  return id;
}
