import { describe, expect, it } from "vitest";
import { appendAuditEvent, getAuditEvents, stableStringify, verifyAuditChain } from "@/lib/audit";
import { makeDb, seedWorkspace } from "./helpers";

function setup() {
  const db = makeDb();
  const { workspaceId } = seedWorkspace(db);
  db.prepare(
    `INSERT INTO documents (id, workspace_id, created_by, title, status, created_at, updated_at)
     VALUES ('doc_audit', ?, 'usr_owner', 'Audit test', 'DRAFT', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
  ).run(workspaceId);
  return { db, workspaceId };
}

describe("stableStringify", () => {
  it("orders object keys independently of insertion order", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it("keeps array order and drops undefined values", () => {
    expect(stableStringify({ list: [2, 1], skip: undefined })).toBe('{"list":[2,1]}');
  });
});

describe("audit hash chain", () => {
  it("links events and verifies a clean chain", () => {
    const { db, workspaceId } = setup();
    appendAuditEvent(db, {
      documentId: "doc_audit",
      workspaceId,
      eventType: "document.created",
      actorKind: "sender",
      actorId: "usr_owner",
      actorLabel: "Dana Owner",
    });
    appendAuditEvent(db, {
      documentId: "doc_audit",
      workspaceId,
      eventType: "recipient.invited",
      actorKind: "sender",
      metadata: { email: "sam@example.com" },
    });
    appendAuditEvent(db, {
      documentId: "doc_audit",
      workspaceId,
      eventType: "document.sent",
      actorKind: "system",
      actorLabel: "SignFlow",
    });

    const events = getAuditEvents(db, "doc_audit");
    expect(events).toHaveLength(3);
    expect(events[0].previous_hash).toBe("");
    expect(events[1].previous_hash).toBe(events[0].entry_hash);
    expect(events[2].previous_hash).toBe(events[1].entry_hash);
    expect(new Set(events.map((event) => event.entry_hash)).size).toBe(3);

    expect(verifyAuditChain(db, "doc_audit")).toEqual({ valid: true, events: 3 });
  });

  it("detects tampered metadata", () => {
    const { db, workspaceId } = setup();
    appendAuditEvent(db, {
      documentId: "doc_audit",
      workspaceId,
      eventType: "document.created",
      actorKind: "sender",
    });
    const second = appendAuditEvent(db, {
      documentId: "doc_audit",
      workspaceId,
      eventType: "recipient.signed",
      actorKind: "recipient",
      metadata: { recipientId: "rcp_1" },
    });

    db.prepare("UPDATE audit_events SET metadata_json = ? WHERE id = ?").run(
      JSON.stringify({ recipientId: "rcp_2" }),
      second,
    );

    const result = verifyAuditChain(db, "doc_audit");
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(second);
  });

  it("detects a broken previous-hash link even when the entry hash is intact", () => {
    const { db, workspaceId } = setup();
    appendAuditEvent(db, {
      documentId: "doc_audit",
      workspaceId,
      eventType: "document.created",
      actorKind: "sender",
    });
    const second = appendAuditEvent(db, {
      documentId: "doc_audit",
      workspaceId,
      eventType: "document.sent",
      actorKind: "sender",
    });

    db.prepare("UPDATE audit_events SET previous_hash = ? WHERE id = ?").run("f".repeat(64), second);

    expect(verifyAuditChain(db, "doc_audit")).toMatchObject({
      valid: false,
      brokenAt: second,
    });
  });

  it("scopes chains per document", () => {
    const { db, workspaceId } = setup();
    db.prepare(
      `INSERT INTO documents (id, workspace_id, created_by, title, status, created_at, updated_at)
       VALUES ('doc_other', ?, 'usr_owner', 'Other', 'DRAFT', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    ).run(workspaceId);
    appendAuditEvent(db, {
      documentId: "doc_audit",
      workspaceId,
      eventType: "document.created",
      actorKind: "sender",
    });
    appendAuditEvent(db, {
      documentId: "doc_other",
      workspaceId,
      eventType: "document.created",
      actorKind: "sender",
    });

    expect(getAuditEvents(db, "doc_audit")).toHaveLength(1);
    expect(getAuditEvents(db, "doc_other")[0].previous_hash).toBe("");
    expect(verifyAuditChain(db, "doc_audit").valid).toBe(true);
    expect(verifyAuditChain(db, "doc_other").valid).toBe(true);
  });
});
