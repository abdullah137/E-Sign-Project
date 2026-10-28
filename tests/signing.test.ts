import { describe, expect, it } from "vitest";
import {
  declineSigning,
  getSigningContext,
  markSignerOpened,
  recordConsent,
} from "@/lib/documents";
import { addRecipient, makeDb, seedSigningDocument, seedWorkspace } from "./helpers";

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
