import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";

const storageMock = vi.hoisted(() => ({
  copyStoredObject: vi.fn(() => ({
    storageKey: "ws_test/copied.pdf",
    sha256: "c".repeat(64),
    bytes: 700,
  })),
}));

vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return { ...actual, copyStoredObject: storageMock.copyStoredObject };
});

import {
  archiveTemplate,
  createDocumentFromTemplate,
  createPublicLink,
  getPublicLinkContext,
  getTemplate,
  listTemplates,
  publicLinkToken,
  publicLinkUrl,
  redeemPublicLink,
  requestPublicLinkOtp,
  revokePublicLink,
  type PublicLinkRow,
} from "@/lib/templates";
import { verifyAuditChain } from "@/lib/audit";
import { ConflictError, ValidationError } from "@/lib/errors";
import { addDocument, addPublicLink, addTemplate, makeDb, seedWorkspace } from "./helpers";

beforeEach(() => {
  storageMock.copyStoredObject.mockClear();
});

function recipientsOf(db: DatabaseSync, documentId: string) {
  return db
    .prepare("SELECT id, name, email, signing_order FROM recipients WHERE document_id = ? ORDER BY signing_order")
    .all(documentId) as Array<{ id: string; name: string; email: string; signing_order: number }>;
}

function fieldsOf(db: DatabaseSync, documentId: string) {
  return db
    .prepare("SELECT recipient_id, type, required FROM fields WHERE document_id = ? ORDER BY rowid")
    .all(documentId) as Array<{ recipient_id: string; type: string; required: number }>;
}

describe("createDocumentFromTemplate", () => {
  it("copies the PDF and maps slots to recipients and fields", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    const templateId = addTemplate(db, workspaceId, {
      slots: 2,
      fields: [
        { slot: 0, type: "signature" },
        { slot: 1, type: "text", required: false },
      ],
    });

    const { documentId } = createDocumentFromTemplate(db, {
      workspaceId,
      userId: "usr_owner",
      userLabel: "Dana Owner",
      templateId,
      recipients: [
        { name: "Amelia Hart", email: "amelia@example.com" },
        { name: "", email: "nadia@example.com" },
      ],
    });

    expect(storageMock.copyStoredObject).toHaveBeenCalledWith("ws_source/source.pdf", workspaceId);
    const document = db.prepare("SELECT * FROM documents WHERE id = ?").get(documentId) as {
      status: string;
      title: string;
      created_by: string;
    };
    expect(document.status).toBe("DRAFT");
    expect(document.title).toBe("Template");
    expect(document.created_by).toBe("usr_owner");

    const file = db
      .prepare("SELECT * FROM document_files WHERE document_id = ?")
      .get(documentId) as { storage_key: string; page_count: number; sha256: string };
    expect(file.storage_key).toBe("ws_test/copied.pdf");
    expect(file.page_count).toBe(1);
    expect(file.sha256).toBe("c".repeat(64));

    const recipients = recipientsOf(db, documentId);
    expect(recipients).toHaveLength(2);
    expect(recipients[0].email).toBe("amelia@example.com");
    expect(recipients[0].name).toBe("Amelia Hart");
    expect(recipients[1].email).toBe("nadia@example.com");
    expect(recipients[1].name).toBe("Signer 2");

    const fields = fieldsOf(db, documentId);
    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({ recipient_id: recipients[0].id, type: "signature", required: 1 });
    expect(fields[1]).toMatchObject({ recipient_id: recipients[1].id, type: "text", required: 0 });

    expect(verifyAuditChain(db, documentId)).toEqual({ valid: true, events: 1 });
    const event = db
      .prepare("SELECT event_type, actor_label FROM audit_events WHERE document_id = ?")
      .get(documentId) as { event_type: string; actor_label: string };
    expect(event).toEqual({
      event_type: "document.created_from_template",
      actor_label: "Dana Owner",
    });
  });

  it("requires one recipient per template slot", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    const templateId = addTemplate(db, workspaceId, { slots: 2 });

    expect(() =>
      createDocumentFromTemplate(db, {
        workspaceId,
        userId: "usr_owner",
        userLabel: "Dana Owner",
        templateId,
        recipients: [{ name: "Amelia Hart", email: "amelia@example.com" }],
      }),
    ).toThrow(/needs 2 recipients/i);
    expect(storageMock.copyStoredObject).not.toHaveBeenCalled();
  });

  it("rejects duplicate and invalid recipient emails", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    const templateId = addTemplate(db, workspaceId, { slots: 2 });

    expect(() =>
      createDocumentFromTemplate(db, {
        workspaceId,
        userId: "usr_owner",
        userLabel: "Dana Owner",
        templateId,
        recipients: [
          { name: "Amelia", email: "amelia@example.com" },
          { name: "Other", email: "AMELIA@example.com" },
        ],
      }),
    ).toThrow(ValidationError);
    expect(() =>
      createDocumentFromTemplate(db, {
        workspaceId,
        userId: "usr_owner",
        userLabel: "Dana Owner",
        templateId,
        recipients: [
          { name: "Amelia", email: "not-an-email" },
          { name: "Other", email: "other@example.com" },
        ],
      }),
    ).toThrow(/valid email/i);
  });

  it("enforces the monthly document quota", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db, "free");
    const templateId = addTemplate(db, workspaceId);
    for (let index = 1; index <= 5; index += 1) {
      addDocument(db, workspaceId, { id: `doc_quota_${index}` });
    }

    expect(() =>
      createDocumentFromTemplate(db, {
        workspaceId,
        userId: "usr_owner",
        userLabel: "Dana Owner",
        templateId,
        recipients: [{ name: "Amelia", email: "amelia@example.com" }],
      }),
    ).toThrow(/monthly limit/i);
  });
});

describe("template listing and archiving", () => {
  it("summarizes fields, slots and active public links", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    const templateId = addTemplate(db, workspaceId, {
      fields: [{ slot: 0 }, { slot: 0, type: "text" }],
    });
    const link = createPublicLink(db, { workspaceId, templateId, name: "Website request" });

    const templates = listTemplates(db, workspaceId);
    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({
      id: templateId,
      name: "Template",
      fieldCount: 2,
      pageCount: 1,
      publicLinkCount: 1,
    });
    expect(templates[0].recipientSlots).toHaveLength(1);
    expect(link.url).toContain(`/p/${publicLinkToken(db, link.id)}`);
  });

  it("refuses to archive a template with active public links", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    const templateId = addTemplate(db, workspaceId);
    const link = createPublicLink(db, { workspaceId, templateId, name: "Website request" });

    expect(() => archiveTemplate(db, workspaceId, templateId)).toThrow(ConflictError);
    revokePublicLink(db, workspaceId, link.id);
    archiveTemplate(db, workspaceId, templateId);
    expect(getTemplate(db, workspaceId, templateId)?.status).toBe("archived");
    expect(listTemplates(db, workspaceId)).toHaveLength(0);
  });
});

describe("public links", () => {
  it("rejects multi-recipient templates", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    const templateId = addTemplate(db, workspaceId, { slots: 2 });

    expect(() =>
      createPublicLink(db, { workspaceId, templateId, name: "Website request" }),
    ).toThrow(/exactly one recipient/i);
  });

  it("resolves active, revoked, expired and unavailable states", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    const templateId = addTemplate(db, workspaceId);
    const link = createPublicLink(db, { workspaceId, templateId, name: "Website request" });
    const token = publicLinkToken(db, link.id);

    expect(publicLinkToken(db, link.id)).toBe(token);
    expect(publicLinkUrl(db, link.id)).toContain(`/p/${token}`);
    const active = getPublicLinkContext(db, token);
    expect(active.ok).toBe(true);
    if (active.ok) {
      expect(active.workspace.owner_id).toBe("usr_owner");
      expect(active.slotCount).toBe(1);
      expect(active.fieldCount).toBe(1);
    }

    expect(getPublicLinkContext(db, "short")).toEqual({ ok: false, reason: "invalid" });
    expect(getPublicLinkContext(db, `${token}x`)).toEqual({ ok: false, reason: "invalid" });

    revokePublicLink(db, workspaceId, link.id);
    expect(getPublicLinkContext(db, token)).toEqual({ ok: false, reason: "revoked" });

    const expiredToken = "public-link-token-expired-123456";
    addPublicLink(db, workspaceId, templateId, expiredToken, {
      id: "lnk_expired",
      expiresAt: "2020-01-01T00:00:00.000Z",
    });
    expect(getPublicLinkContext(db, expiredToken)).toEqual({ ok: false, reason: "expired" });

    const unavailableToken = "public-link-token-unavailable-123456";
    addPublicLink(db, workspaceId, templateId, unavailableToken, { id: "lnk_unavailable" });
    db.prepare("UPDATE templates SET status = 'archived' WHERE id = ?").run(templateId);
    expect(getPublicLinkContext(db, unavailableToken)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("requests and redeems a one-time verification code", async () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    const templateId = addTemplate(db, workspaceId);
    const token = "public-link-token-signing-1234567890";
    addPublicLink(db, workspaceId, templateId, token);
    const link = db.prepare("SELECT * FROM public_links WHERE id = 'lnk_test'").get() as unknown as PublicLinkRow;

    const { code } = requestPublicLinkOtp(db, link, "Jordan.Lee@example.com");
    expect(code).toMatch(/^\d{6}$/);
    await expect(
      redeemPublicLink(db, {
        rawToken: token,
        name: "Jordan Lee",
        email: "jordan.lee@example.com",
        code: code === "000000" ? "000001" : "000000",
      }),
    ).rejects.toThrow(/not correct/i);
    const otp = db
      .prepare("SELECT attempts, consumed_at FROM public_link_otps WHERE link_id = ?")
      .get(link.id) as { attempts: number; consumed_at: string | null };
    expect(otp.attempts).toBe(1);
    expect(otp.consumed_at).toBeNull();

    const result = await redeemPublicLink(db, {
      rawToken: token,
      name: "Jordan Lee",
      email: "jordan.lee@example.com",
      code,
      ip: "127.0.0.1",
      userAgent: "test",
    });
    expect(result.documentId).toMatch(/^doc_/);
    expect(result.signingUrl).toContain("/sign/");

    const document = db.prepare("SELECT status FROM documents WHERE id = ?").get(result.documentId) as {
      status: string;
    };
    expect(document.status).toBe("PENDING");
    const recipients = db
      .prepare("SELECT name, email, status FROM recipients WHERE document_id = ?")
      .all(result.documentId) as Array<{ name: string; email: string; status: string }>;
    expect(recipients).toEqual([
      { name: "Jordan Lee", email: "jordan.lee@example.com", status: "INVITED" },
    ]);
    const fields = db
      .prepare("SELECT COUNT(*) AS count FROM fields WHERE document_id = ?")
      .get(result.documentId) as { count: number };
    expect(Number(fields.count)).toBe(1);

    const used = db
      .prepare("SELECT last_used_at FROM public_links WHERE id = ?")
      .get(link.id) as { last_used_at: string | null };
    expect(used.last_used_at).toBeTruthy();
    const audit = db
      .prepare("SELECT event_type FROM audit_events WHERE document_id = ? ORDER BY rowid")
      .all(result.documentId) as Array<{ event_type: string }>;
    expect(audit.map((event) => event.event_type)).toContain("public_link.used");
    expect(verifyAuditChain(db, result.documentId).valid).toBe(true);

    await expect(
      redeemPublicLink(db, {
        rawToken: token,
        name: "Jordan Lee",
        email: "jordan.lee@example.com",
        code,
      }),
    ).rejects.toThrow(/Request a new verification code/i);

    const documents = db.prepare("SELECT COUNT(*) AS count FROM documents").get() as {
      count: number;
    };
    expect(Number(documents.count)).toBe(1);
  });

  it("rejects expired and exhausted verification codes", async () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    const templateId = addTemplate(db, workspaceId);
    const token = "public-link-token-codes-123456789";
    addPublicLink(db, workspaceId, templateId, token);
    const link = db.prepare("SELECT * FROM public_links WHERE id = 'lnk_test'").get() as unknown as PublicLinkRow;

    const first = requestPublicLinkOtp(db, link, "sam@example.com");
    db.prepare("UPDATE public_link_otps SET expires_at = ? WHERE link_id = ?").run(
      "2020-01-01T00:00:00.000Z",
      link.id,
    );
    await expect(
      redeemPublicLink(db, {
        rawToken: token,
        name: "Sam Signer",
        email: "sam@example.com",
        code: first.code,
      }),
    ).rejects.toThrow(/expired/i);

    const second = requestPublicLinkOtp(db, link, "sam@example.com");
    db.prepare("UPDATE public_link_otps SET attempts = 5 WHERE link_id = ? AND consumed_at IS NULL").run(
      link.id,
    );
    await expect(
      redeemPublicLink(db, {
        rawToken: token,
        name: "Sam Signer",
        email: "sam@example.com",
        code: second.code,
      }),
    ).rejects.toThrow(/Too many attempts/i);
  });
});
