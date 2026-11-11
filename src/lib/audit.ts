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
  recipientId?: string | null;
  processedAt?: string | null;
  deliveryStatus?: "pending" | "sent" | "failed" | "not_applicable" | null;
  deliveredAt?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
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
  recipient_id: string | null;
  /** Monotonic per-document order assigned by the server. */
  sequence: number;
  /** When the server accepted the business event (UTC). */
  at: string;
  /** When a worker finished processing the event (UTC), when applicable. */
  processed_at: string | null;
  delivery_status: string | null;
  /** When an external provider confirmed delivery (UTC), when applicable. */
  delivered_at: string | null;
  correlation_id: string | null;
  causation_id: string | null;
  hash_version: number;
  ip: string | null;
  user_agent: string | null;
  metadata_json: string;
  previous_hash: string;
  entry_hash: string;
}

function hashPayload(event: {
  id: string;
  documentId: string;
  workspaceId: string;
  eventType: string;
  actorKind: string;
  actorId: string | null;
  actorLabel: string | null;
  at: string;
  sequence?: number | null;
  recipientId?: string | null;
  processedAt?: string | null;
  deliveryStatus?: string | null;
  deliveredAt?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
  hashVersion?: number;
  metadata: Record<string, unknown>;
}): string {
  const version = event.hashVersion ?? 1;
  const payload: Record<string, unknown> = {
    id: event.id,
    documentId: event.documentId,
    workspaceId: event.workspaceId,
    eventType: event.eventType,
    actorKind: event.actorKind,
    actorId: event.actorId,
    actorLabel: event.actorLabel,
    at: event.at,
    metadata: event.metadata,
  };
  // Version 1 events predate the timeline columns; their payload must stay
  // byte-identical so the historical chain keeps verifying.
  if (version >= 2) {
    payload.version = 2;
    payload.sequence = event.sequence ?? null;
    payload.recipientId = event.recipientId ?? null;
    payload.processedAt = event.processedAt ?? null;
    payload.deliveryStatus = event.deliveryStatus ?? null;
    payload.deliveredAt = event.deliveredAt ?? null;
    payload.correlationId = event.correlationId ?? null;
    payload.causationId = event.causationId ?? null;
  }
  return stableStringify(payload);
}

export function appendAuditEvent(db: DatabaseSync, input: AuditInput): string {
  const at = nowIso();
  const id = `evt_${randomUUID().replace(/-/g, "")}`;
  const previous = db
    .prepare(
      "SELECT entry_hash, sequence FROM audit_events WHERE document_id = ? ORDER BY sequence DESC, at DESC, rowid DESC LIMIT 1",
    )
    .get(input.documentId) as { entry_hash: string; sequence: number | null } | undefined;
  const previousHash = previous?.entry_hash ?? "";
  const sequence = Number(previous?.sequence ?? 0) + 1;
  const metadata = input.metadata ?? {};
  const canonical = hashPayload({
    id,
    documentId: input.documentId,
    workspaceId: input.workspaceId,
    eventType: input.eventType,
    actorKind: input.actorKind,
    actorId: input.actorId ?? null,
    actorLabel: input.actorLabel ?? null,
    at,
    sequence,
    recipientId: input.recipientId ?? null,
    processedAt: input.processedAt ?? null,
    deliveryStatus: input.deliveryStatus ?? null,
    deliveredAt: input.deliveredAt ?? null,
    correlationId: input.correlationId ?? null,
    causationId: input.causationId ?? null,
    hashVersion: 2,
    metadata,
  });
  const entryHash = createHash("sha256")
    .update(`${previousHash}\n${canonical}`)
    .digest("hex");

  db.prepare(
    `INSERT INTO audit_events
      (id, document_id, workspace_id, event_type, actor_kind, actor_id, actor_label, recipient_id,
       sequence, at, processed_at, delivery_status, delivered_at, correlation_id, causation_id,
       hash_version, ip, user_agent, metadata_json, previous_hash, entry_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.documentId,
    input.workspaceId,
    input.eventType,
    input.actorKind,
    input.actorId ?? null,
    input.actorLabel ?? null,
    input.recipientId ?? null,
    sequence,
    at,
    input.processedAt ?? null,
    input.deliveryStatus ?? null,
    input.deliveredAt ?? null,
    input.correlationId ?? null,
    input.causationId ?? null,
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
    .prepare(
      "SELECT * FROM audit_events WHERE document_id = ? ORDER BY sequence ASC, at ASC, rowid ASC",
    )
    .all(documentId) as unknown as AuditEventRow[];
}

export function verifyAuditChain(
  db: DatabaseSync,
  documentId: string,
): { valid: boolean; events: number; brokenAt?: string } {
  const events = getAuditEvents(db, documentId);
  let previousHash = "";
  for (const event of events) {
    const canonical = hashPayload({
      id: event.id,
      documentId: event.document_id,
      workspaceId: event.workspace_id,
      eventType: event.event_type,
      actorKind: event.actor_kind,
      actorId: event.actor_id,
      actorLabel: event.actor_label,
      at: event.at,
      sequence: event.sequence,
      recipientId: event.recipient_id,
      processedAt: event.processed_at,
      deliveryStatus: event.delivery_status,
      deliveredAt: event.delivered_at,
      correlationId: event.correlation_id,
      causationId: event.causation_id,
      hashVersion: event.hash_version,
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
