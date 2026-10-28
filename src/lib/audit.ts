import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { nowIso } from "./ids";

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export interface AuditInput {
  documentId: string;
  workspaceId: string;
  eventType: string;
  actorKind: "sender" | "recipient" | "system" | "public";
  actorId?: string | null;
  actorLabel?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuditEventRow {
  id: string;
  document_id: string;
  workspace_id: string;
  event_type: string;
  actor_kind: string;
  actor_id: string | null;
  actor_label: string | null;
  at: string;
  ip: string | null;
  user_agent: string | null;
  metadata_json: string;
  previous_hash: string;
  entry_hash: string;
}

export function appendAuditEvent(db: DatabaseSync, input: AuditInput): string {
  const at = nowIso();
  const id = `evt_${randomUUID().replace(/-/g, "")}`;
  const previous = db
    .prepare(
      "SELECT entry_hash FROM audit_events WHERE document_id = ? ORDER BY rowid DESC LIMIT 1",
    )
    .get(input.documentId) as { entry_hash: string } | undefined;
  const previousHash = previous?.entry_hash ?? "";
  const metadata = input.metadata ?? {};
  const canonical = stableStringify({
    id,
    documentId: input.documentId,
    workspaceId: input.workspaceId,
    eventType: input.eventType,
    actorKind: input.actorKind,
    actorId: input.actorId ?? null,
    actorLabel: input.actorLabel ?? null,
    at,
    metadata,
  });
  const entryHash = createHash("sha256")
    .update(`${previousHash}\n${canonical}`)
    .digest("hex");

  db.prepare(
    `INSERT INTO audit_events
      (id, document_id, workspace_id, event_type, actor_kind, actor_id, actor_label, at, ip, user_agent, metadata_json, previous_hash, entry_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.documentId,
    input.workspaceId,
    input.eventType,
    input.actorKind,
    input.actorId ?? null,
    input.actorLabel ?? null,
    at,
    input.ip ?? null,
    input.userAgent ?? null,
    JSON.stringify(metadata),
    previousHash,
    entryHash,
  );
  return id;
}

export function getAuditEvents(db: DatabaseSync, documentId: string): AuditEventRow[] {
  return db
    .prepare("SELECT * FROM audit_events WHERE document_id = ? ORDER BY rowid ASC")
    .all(documentId) as unknown as AuditEventRow[];
}

export function verifyAuditChain(
  db: DatabaseSync,
  documentId: string,
): { valid: boolean; events: number; brokenAt?: string } {
  const events = getAuditEvents(db, documentId);
  let previousHash = "";
  for (const event of events) {
    const canonical = stableStringify({
      id: event.id,
      documentId: event.document_id,
      workspaceId: event.workspace_id,
      eventType: event.event_type,
      actorKind: event.actor_kind,
      actorId: event.actor_id,
      actorLabel: event.actor_label,
      at: event.at,
      metadata: JSON.parse(event.metadata_json || "{}"),
    });
    const expected = createHash("sha256")
      .update(`${previousHash}\n${canonical}`)
      .digest("hex");
    if (event.previous_hash !== previousHash || event.entry_hash !== expected) {
      return { valid: false, events: events.length, brokenAt: event.id };
    }
    previousHash = event.entry_hash;
  }
  return { valid: true, events: events.length };
}
