import { describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import {
  countDocumentsThisMonth,
  fieldIsComplete,
  getDocument,
  validateDocumentForSend,
  type FieldRow,
  type FieldValueRow,
} from "@/lib/documents";
import { getPlan } from "@/lib/plans";
import { addDocument, addField, addRecipient, makeDb, seedWorkspace } from "./helpers";

function readyDocument(db: DatabaseSync, workspaceId: string, plan = "pro") {
  const documentId = addDocument(db, workspaceId);
  const recipientId = addRecipient(db, documentId, { status: "PENDING" });
  addField(db, documentId, recipientId);
  const doc = getDocument(db, documentId);
  if (!doc) throw new Error("fixture document missing");
  return { documentId, recipientId, issues: validateDocumentForSend(db, doc, getPlan(plan)) };
}

describe("validateDocumentForSend", () => {
  it("passes a prepared draft on the pro plan", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    expect(readyDocument(db, workspaceId).issues).toEqual([]);
  });

  it("rejects documents that are not drafts", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    const documentId = addDocument(db, workspaceId, { status: "PENDING" });
    const recipientId = addRecipient(db, documentId, { status: "INVITED" });
    addField(db, documentId, recipientId);
    const doc = getDocument(db, documentId)!;

    const issues = validateDocumentForSend(db, doc, getPlan("pro"));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/already been sent/i);
  });

  it("requires a title, recipients and a PDF", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    const documentId = addDocument(db, workspaceId);
    db.prepare("UPDATE documents SET title = '   ' WHERE id = ?").run(documentId);
    db.prepare("DELETE FROM document_files WHERE document_id = ?").run(documentId);
    const doc = getDocument(db, documentId)!;

    const messages = validateDocumentForSend(db, doc, getPlan("pro")).map((issue) => issue.message);
    expect(messages).toContain("Add a document title.");
    expect(messages).toContain("The original PDF is missing. Upload the document again.");
    expect(messages).toContain("Add at least one recipient.");
  });

  it("requires every recipient to have at least one field", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    const { documentId, issues } = readyDocument(db, workspaceId);
    const extra = addRecipient(db, documentId, { id: "rcp_extra", email: "other@example.com" });

    const next = validateDocumentForSend(db, getDocument(db, documentId)!, getPlan("pro"));
    expect(issues).toEqual([]);
    expect(next).toContainEqual(
      expect.objectContaining({
        scope: "recipient",
        recipientId: extra,
        message: expect.stringMatching(/Assign at least one field/i),
      }),
    );
  });

  it("rejects invalid recipient addresses", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    const { documentId } = readyDocument(db, workspaceId);
    const invalid = addRecipient(db, documentId, { id: "rcp_invalid", email: "not-an-email" });
    addField(db, documentId, invalid, { id: "fld_invalid" });

    const issues = validateDocumentForSend(db, getDocument(db, documentId)!, getPlan("pro"));
    expect(issues).toContainEqual(
      expect.objectContaining({ recipientId: invalid, message: expect.stringMatching(/valid email/i) }),
    );
  });

  it("enforces the plan recipient limit", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db, "free");
    const { documentId } = readyDocument(db, workspaceId, "free");
    for (let index = 2; index <= 4; index += 1) {
      const recipient = addRecipient(db, documentId, {
        id: `rcp_${index}`,
        email: `signer${index}@example.com`,
      });
      addField(db, documentId, recipient, { id: `fld_${index}` });
    }

    const issues = validateDocumentForSend(db, getDocument(db, documentId)!, getPlan("free"));
    expect(issues).toContainEqual(
      expect.objectContaining({ scope: "document", message: expect.stringMatching(/3 recipients per document/i) }),
    );
  });

  it("rejects fields with invalid geometry, page or type", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    const { documentId } = readyDocument(db, workspaceId);
    db.prepare(
      "UPDATE fields SET x = 0.9, width = 0.2, page_index = 4, type = 'unsupported' WHERE document_id = ?",
    ).run(documentId);

    const messages = validateDocumentForSend(db, getDocument(db, documentId)!, getPlan("pro")).map(
      (issue) => issue.message,
    );
    expect(messages).toContain("A field extends beyond the page boundary.");
    expect(messages).toContain("A field is placed on a page that does not exist.");
    expect(messages).toContain("A field has an unsupported type.");
  });

  it("enforces the monthly document quota", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db, "free");
    const { documentId } = readyDocument(db, workspaceId, "free");
    for (let index = 2; index <= 5; index += 1) {
      addDocument(db, workspaceId, { id: `doc_extra_${index}` });
    }

    const issues = validateDocumentForSend(db, getDocument(db, documentId)!, getPlan("free"));
    expect(issues).toContainEqual(
      expect.objectContaining({ scope: "document", message: expect.stringMatching(/5-document monthly limit/i) }),
    );
  });
});

describe("countDocumentsThisMonth", () => {
  it("counts current, non-deleted documents only", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    addDocument(db, workspaceId, { id: "doc_current" });
    addDocument(db, workspaceId, { id: "doc_old", createdAt: "2020-01-01T00:00:00.000Z" });
    addDocument(db, workspaceId, { id: "doc_deleted", status: "DELETED" });

    expect(countDocumentsThisMonth(db, workspaceId)).toBe(1);
  });
});

const field = (type: string) => ({ type }) as FieldRow;
const value = (input: Partial<FieldValueRow>) => input as FieldValueRow;

describe("fieldIsComplete", () => {
  it("requires a signature asset for signatures and initials", () => {
    expect(fieldIsComplete(field("signature"), undefined)).toBe(false);
    expect(fieldIsComplete(field("signature"), value({ signature_asset_id: null }))).toBe(false);
    expect(fieldIsComplete(field("signature"), value({ signature_asset_id: "ast_1" }))).toBe(true);
    expect(fieldIsComplete(field("initials"), value({ signature_asset_id: "ast_1" }))).toBe(true);
  });

  it("requires checked checkboxes", () => {
    expect(fieldIsComplete(field("checkbox"), value({ checked: 0 }))).toBe(false);
    expect(fieldIsComplete(field("checkbox"), value({ checked: 1 }))).toBe(true);
  });

  it("rejects blank text and invalid email values", () => {
    expect(fieldIsComplete(field("text"), value({ value_text: "   " }))).toBe(false);
    expect(fieldIsComplete(field("text"), value({ value_text: "Acme Inc." }))).toBe(true);
    expect(fieldIsComplete(field("email"), value({ value_text: "not-an-email" }))).toBe(false);
    expect(fieldIsComplete(field("email"), value({ value_text: "sam@example.com" }))).toBe(true);
  });
});
