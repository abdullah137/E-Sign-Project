import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  completeSigning,
  declineSigning,
  getAuditForDocument,
  getSigningContext,
  markSignerOpened,
  recordConsent,
  saveFieldValue,
} from "@/lib/documents";
import { verifyAuditChain } from "@/lib/audit";
import { deleteStoredObject, readStoredObject, saveBuffer } from "@/lib/storage";
import {
  addDocument,
  addField,
  addRecipient,
  makeDb,
  seedSigningDocument,
  seedWorkspace,
} from "./helpers";

function fixture(options: { docStatus?: string; tokenExpiresAt?: string | null } = {}) {
  const db = makeDb();
  const { workspaceId } = seedWorkspace(db);
  const ids = seedSigningDocument(db, workspaceId, {
    token: "signing-token-value-1234567890",
    docStatus: options.docStatus,
    tokenExpiresAt: options.tokenExpiresAt,
  });
  return { db, workspaceId, ...ids };
}

describe("getSigningContext", () => {
  it("returns the signing context for a valid token", () => {
    const { db } = fixture();
    const lookup = getSigningContext(db, "signing-token-value-1234567890");
    expect(lookup.ok).toBe(true);
    if (!lookup.ok) return;
    expect(lookup.context.document.status).toBe("PENDING");
    expect(lookup.context.recipient.status).toBe("INVITED");
    expect(lookup.context.senderName).toBe("Dana Owner");
    expect(lookup.context.viewState).toBe("signing");
    expect(lookup.context.fields).toHaveLength(1);
    expect(lookup.context.progress).toEqual({ required: 1, completed: 0 });
  });

  it("rejects unknown tokens", () => {
    const { db } = fixture();
    expect(getSigningContext(db, "not-a-real-token")).toEqual({ ok: false, reason: "not_found" });
  });

  it("reports voided documents", () => {
    const { db } = fixture({ docStatus: "VOIDED" });
    expect(getSigningContext(db, "signing-token-value-1234567890")).toEqual({
      ok: false,
      reason: "voided",
    });
  });

  it("reports declined recipients", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    const { documentId, recipientId } = seedSigningDocument(db, workspaceId, {
      token: "signing-token-value-1234567890",
    });
    db.prepare("UPDATE recipients SET status = 'DECLINED' WHERE id = ?").run(recipientId);
    expect(getSigningContext(db, "signing-token-value-1234567890")).toEqual({
      ok: false,
      reason: "declined",
    });
    expect(documentId).toBeTruthy();
  });

  it("reports revoked or expired recipients", () => {
    const { db } = fixture();
    db.prepare("UPDATE recipients SET status = 'REVOKED' WHERE document_id = 'doc_test'").run();
    expect(getSigningContext(db, "signing-token-value-1234567890")).toEqual({
      ok: false,
      reason: "revoked",
    });
  });

  it("reports expired per-recipient tokens", () => {
    const { db } = fixture({ tokenExpiresAt: "2020-01-01T00:00:00.000Z" });
    expect(getSigningContext(db, "signing-token-value-1234567890")).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("expires a PENDING document whose deadline has passed", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    const { documentId, recipientId } = seedSigningDocument(db, workspaceId, {
      token: "signing-token-value-1234567890",
    });
    db.prepare("UPDATE documents SET expires_at = ? WHERE id = ?").run(
      "2020-01-01T00:00:00.000Z",
      documentId,
    );

    expect(getSigningContext(db, "signing-token-value-1234567890")).toEqual({
      ok: false,
      reason: "expired",
    });
    const document = db.prepare("SELECT status FROM documents WHERE id = ?").get(documentId) as {
      status: string;
    };
    const recipient = db.prepare("SELECT status, token_hash FROM recipients WHERE id = ?").get(recipientId) as {
      status: string;
      token_hash: string | null;
    };
    expect(document.status).toBe("EXPIRED");
    expect(recipient.status).toBe("EXPIRED");
    expect(recipient.token_hash).toBeNull();
  });

  it("exposes a completed view state for completed documents", () => {
    const { db } = fixture({ docStatus: "COMPLETED" });
    const lookup = getSigningContext(db, "signing-token-value-1234567890");
    expect(lookup.ok).toBe(true);
    if (!lookup.ok) return;
    expect(lookup.context.viewState).toBe("completed");
  });
});

describe("signing state transitions", () => {
  it("moves an invited recipient to opened once", () => {
    const { db, recipientId } = fixture();
    const token = "signing-token-value-1234567890";
    markSignerOpened(db, token, { ip: "127.0.0.1", userAgent: "test" });
    markSignerOpened(db, token, { ip: "127.0.0.1", userAgent: "test" });

    const row = db.prepare("SELECT status, opened_at FROM recipients WHERE id = ?").get(recipientId) as {
      status: string;
      opened_at: string | null;
    };
    expect(row.status).toBe("OPENED");
    expect(row.opened_at).toBeTruthy();
    const events = db
      .prepare("SELECT event_type FROM audit_events WHERE document_id = 'doc_test' ORDER BY rowid")
      .all() as Array<{ event_type: string }>;
    expect(events.filter((event) => event.event_type === "recipient.opened")).toHaveLength(1);
  });

  it("records consent idempotently", () => {
    const { db, recipientId } = fixture();
    const token = "signing-token-value-1234567890";
    recordConsent(db, token, { ip: null, userAgent: null });
    recordConsent(db, token, { ip: null, userAgent: null });

    const row = db
      .prepare("SELECT status, consent_at, consent_version FROM recipients WHERE id = ?")
      .get(recipientId) as {
      status: string;
      consent_at: string | null;
      consent_version: string | null;
    };
    expect(row.status).toBe("CONSENTED");
    expect(row.consent_at).toBeTruthy();
    expect(row.consent_version).toBe("esign-consent-1.0");
    const count = db
      .prepare("SELECT COUNT(*) AS count FROM audit_events WHERE document_id = 'doc_test' AND event_type = 'consent.accepted'")
      .get() as { count: number };
    expect(Number(count.count)).toBe(1);
  });

  it("voids the document and revokes other links when a recipient declines", async () => {
    const { db, workspaceId, documentId, recipientId } = fixture();
    const other = addRecipient(db, documentId, {
      id: "rcp_other",
      name: "Other Signer",
      email: "other@example.com",
      token: "other-signing-token-value-12345",
      tokenExpiresAt: "2099-01-01T00:00:00.000Z",
    });

    await declineSigning(db, "signing-token-value-1234567890", "Terms are wrong", {
      ip: "127.0.0.1",
      userAgent: "test",
    });

    const document = db.prepare("SELECT status, void_reason FROM documents WHERE id = ?").get(documentId) as {
      status: string;
      void_reason: string;
    };
    const declined = db.prepare("SELECT status FROM recipients WHERE id = ?").get(recipientId) as {
      status: string;
    };
    const revoked = db.prepare("SELECT status, token_hash FROM recipients WHERE id = ?").get(other) as {
      status: string;
      token_hash: string | null;
    };
    expect(document.status).toBe("VOIDED");
    expect(document.void_reason).toMatch(/Declined by Sam Signer/);
    expect(declined.status).toBe("DECLINED");
    expect(revoked.status).toBe("REVOKED");
    expect(revoked.token_hash).toBeNull();
    expect(getSigningContext(db, "other-signing-token-value-12345")).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(getSigningContext(db, "signing-token-value-1234567890")).toEqual({
      ok: false,
      reason: "voided",
    });
    const outbox = db
      .prepare("SELECT kind FROM email_outbox WHERE document_id = ?")
      .all(documentId) as Array<{ kind: string }>;
    expect(outbox.some((item) => item.kind === "signing_declined")).toBe(true);
    expect(workspaceId).toBe("ws_test");
  });
});

describe("multi-recipient lifecycle", () => {
  it("keeps partial signing visible, finalizes the PDF and appends an ordered audit chain", async () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const documentId = addDocument(db, workspaceId, { status: "PENDING", expiresAt });

    const pdf = await PDFDocument.create();
    pdf.addPage([612, 792]);
    const original = saveBuffer(workspaceId, Buffer.from(await pdf.save()), "pdf");
    db.prepare(
      "UPDATE document_files SET storage_key = ?, bytes = ? WHERE document_id = ? AND kind = 'original'",
    ).run(original.storageKey, original.bytes, documentId);

    const aliceToken = "alice-signing-token-1234567890";
    const bobToken = "bob-signing-token-123456789012";
    const alice = addRecipient(db, documentId, {
      id: "rcp_alice",
      name: "Alice Signer",
      email: "alice@example.com",
      token: aliceToken,
      tokenExpiresAt: expiresAt,
    });
    const bob = addRecipient(db, documentId, {
      id: "rcp_bob",
      name: "Bob Signer",
      email: "bob@example.com",
      token: bobToken,
      tokenExpiresAt: expiresAt,
    });
    const aliceField = addField(db, documentId, alice, { id: "fld_alice", type: "text" });
    const bobField = addField(db, documentId, bob, { id: "fld_bob", type: "text" });

    for (const [token, fieldId, value] of [
      [aliceToken, aliceField, "Alice Signer"],
      [bobToken, bobField, "Bob Signer"],
    ] as const) {
      markSignerOpened(db, token, { ip: "127.0.0.1", userAgent: "test" });
      recordConsent(db, token, { ip: "127.0.0.1", userAgent: "test" });
      saveFieldValue(db, token, fieldId, { valueText: value }, { ip: "127.0.0.1", userAgent: "test" });
    }

    const first = await completeSigning(db, aliceToken, { ip: "127.0.0.1", userAgent: "test" });
    expect(first).toMatchObject({ alreadySigned: false, documentCompleted: false, finalizationPending: false });
    const partial = db
      .prepare(
        `SELECT d.status AS document_status, a.status AS alice_status, b.status AS bob_status
           FROM documents d
           JOIN recipients a ON a.id = ?
           JOIN recipients b ON b.id = ?
          WHERE d.id = ?`,
      )
      .get(alice, bob, documentId) as {
      document_status: string;
      alice_status: string;
      bob_status: string;
    };
    expect(partial).toEqual({
      document_status: "PENDING",
      alice_status: "SIGNED",
      bob_status: "CONSENTED",
    });

    const second = await completeSigning(db, bobToken, { ip: "127.0.0.1", userAgent: "test" });
    expect(second).toMatchObject({ alreadySigned: false, documentCompleted: true });

    const completed = db
      .prepare("SELECT status, finalized_file_id, completed_at FROM documents WHERE id = ?")
      .get(documentId) as {
      status: string;
      finalized_file_id: string | null;
      completed_at: string | null;
    };
    expect(completed.status).toBe("COMPLETED");
    expect(completed.completed_at).toBeTruthy();
    expect(completed.finalized_file_id).toBeTruthy();

    const finalFile = db
      .prepare("SELECT storage_key, sha256, bytes FROM document_files WHERE id = ?")
      .get(completed.finalized_file_id) as {
      storage_key: string;
      sha256: string;
      bytes: number;
    };
    try {
      expect(finalFile.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(finalFile.bytes).toBeGreaterThan(1024);
      expect(readStoredObject(finalFile.storage_key).length).toBe(finalFile.bytes);
    } finally {
      deleteStoredObject(original.storageKey);
      deleteStoredObject(finalFile.storage_key);
    }

    const events = getAuditForDocument(db, documentId);
    expect(events.map((event) => event.sequence)).toEqual(
      events.map((_, index) => index + 1),
    );
    const signedIndexes = events
      .map((event, index) => (event.event_type === "recipient.signed" ? index : -1))
      .filter((index) => index >= 0);
    expect(signedIndexes).toHaveLength(2);
    const finalizing = events.findIndex((event) => event.event_type === "document.finalizing");
    const finalized = events.findIndex((event) => event.event_type === "document.finalized");
    const completedEvent = events.findIndex((event) => event.event_type === "document.completed");
    expect(signedIndexes[0]).toBeLessThan(signedIndexes[1]);
    expect(signedIndexes[1]).toBeLessThan(finalizing);
    expect(finalizing).toBeLessThan(finalized);
    expect(finalized).toBeLessThan(completedEvent);
    expect(verifyAuditChain(db, documentId).valid).toBe(true);
  });
});
