import { describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { addDocument, makeDb, seedWorkspace } from "./helpers";
import { addDaysIso, hashToken, newId, nowIso } from "@/lib/ids";
import { sendDocument } from "@/lib/documents";
import {
  createAgreementFromPrecedent,
  createInquiry,
  createLandlord,
  createPayment,
  createProperty,
  createUnitsBulk,
  deleteInquiry,
  deleteLandlord,
  deletePayment,
  deleteProperty,
  deleteUnit,
  forwardToLandlord,
  getInquiry,
  getInquiryByLandlordToken,
  getInquiryByTenantToken,
  getInquirySummaryPdf,
  getTenancyStats,
  inquiryFeeCentsFor,
  listAgreements,
  listInquiries,
  listLandlords,
  listPayments,
  listProperties,
  listUnits,
  landlordDecision,
  parsePassportPhotoDataUrl,
  reviewInquiry,
  submitInquiry,
  updateInquiry,
  updateLandlord,
  updatePayment,
  updateProperty,
  updateUnit,
  verifyInquiryTokenHash,
} from "@/lib/tenancy";

function seedLandlordAndProperty(db: DatabaseSync) {
  const { userId, workspaceId } = seedWorkspace(db);
  const landlord = createLandlord(db, {
    workspaceId,
    userId,
    userLabel: "Dana Owner",
    name: "Amara Okafor",
    email: "amara@example.com",
    phone: "+1 512 555 0100",
  });
  const property = createProperty(db, {
    workspaceId,
    userId,
    userLabel: "Dana Owner",
    landlordId: landlord.id,
    reference: "OAK-12",
    name: "12 Oak Street",
    propertyType: "House",
    addressLine1: "12 Oak Street",
    city: "Austin",
    state: "TX",
    bedrooms: 3,
    rentAmountCents: 285_000,
  });
  return { userId, workspaceId, landlord, property };
}

const submission = {
  currentAddress: "18 Willow Lane, Austin, TX",
  reasonForMoving: "Current lease ends soon.",
  maritalStatus: "Single",
  childrenCount: 0,
  employmentStatus: "Employed full-time",
  incomeRange: "60,000 – 99,999",
  signatureName: "Priya Raman",
  guarantors: [{ name: "Michael Raman", email: "michael@example.com", relationship: "Father" }],
};

function addSecondWorkspace(db: DatabaseSync): { userId: string; workspaceId: string } {
  const now = nowIso();
  db.prepare(
    `INSERT INTO users (id, full_name, email, email_normalized, password_hash, email_verified_at, created_at, updated_at)
     VALUES ('usr_other', 'Other Owner', 'other@example.com', 'other@example.com', 'scrypt$test', ?, ?, ?)`,
  ).run(now, now, now);
  db.prepare(
    `INSERT INTO workspaces (id, name, owner_id, plan, brand_display_name, brand_color, created_at)
     VALUES ('ws_other', 'Other Workspace', 'usr_other', 'pro', 'Other Workspace', '#2563EB', ?)`,
  ).run(now);
  db.prepare(
    `INSERT INTO memberships (id, workspace_id, user_id, role, status, created_at)
     VALUES ('mem_other', 'ws_other', 'usr_other', 'owner', 'active', ?)`,
  ).run(now);
  return { userId: "usr_other", workspaceId: "ws_other" };
}

describe("tenancy workspace isolation", () => {
  it("lists only properties and inquiries from the active workspace", () => {
    const db = makeDb();
    const first = seedLandlordAndProperty(db);
    const second = addSecondWorkspace(db);
    const secondLandlord = createLandlord(db, {
      workspaceId: second.workspaceId,
      userId: second.userId,
      userLabel: "Other Owner",
      name: "Second Landlord",
      email: "landlord@example.com",
      phone: "+1 503 555 0100",
    });
    createProperty(db, {
      workspaceId: second.workspaceId,
      userId: second.userId,
      userLabel: "Other Owner",
      landlordId: secondLandlord.id,
      reference: "HBR-4",
      name: "4 Harbour View",
      propertyType: "Apartment",
      addressLine1: "4 Harbour View",
      city: "Portland",
      state: "OR",
      bedrooms: 2,
      rentAmountCents: 320_000,
    });
    const inquiry = createInquiry(db, {
      workspaceId: first.workspaceId,
      userId: first.userId,
      userLabel: "Dana Owner",
      propertyId: first.property.id,
      applicantName: "Priya Raman",
      applicantEmail: "priya@example.com",
      applicantPhone: "+1 512 555 0101",
    });

    expect(listProperties(db, first.workspaceId)).toHaveLength(1);
    expect(listProperties(db, second.workspaceId)).toHaveLength(1);
    expect(listInquiries(db, first.workspaceId).map((row) => row.id)).toEqual([inquiry.inquiry.id]);
    expect(listInquiries(db, second.workspaceId)).toHaveLength(0);
  });

  it("runs workspace list and stats queries with the correct parameters", () => {
    const db = makeDb();
    const { workspaceId } = seedLandlordAndProperty(db);
    const empty = addSecondWorkspace(db);

    const landlords = listLandlords(db, workspaceId);
    expect(landlords).toHaveLength(1);
    expect(Object.getPrototypeOf(landlords[0])).toBe(Object.prototype);
    expect(Object.getPrototypeOf(listProperties(db, workspaceId)[0])).toBe(Object.prototype);
    expect(listAgreements(db, workspaceId)).toEqual([]);
    expect(listPayments(db, workspaceId)).toEqual([]);
    expect(getTenancyStats(db, workspaceId)).toMatchObject({
      landlords: 1,
      properties: 1,
      submitted: 0,
      awaitingLandlord: 0,
      approved: 0,
      agreements: 0,
      duePayments: 0,
      renewalsSoon: 0,
    });
    expect(getTenancyStats(db, empty.workspaceId).landlords).toBe(0);
  });
});

describe("tenant inquiry links", () => {
  it("stores only a hash and lets the applicant submit exactly once", async () => {
    const db = makeDb();
    const { userId, workspaceId, property } = seedLandlordAndProperty(db);
    const created = createInquiry(db, {
      workspaceId,
      userId,
      userLabel: "Dana Owner",
      propertyId: property.id,
      applicantName: "Priya Raman",
      applicantEmail: "priya@example.com",
      applicantPhone: "+1 512 555 0101",
    });
    const token = created.link.split("/inquiry/")[1];

    const row = db
      .prepare("SELECT tenant_token_hash FROM inquiries WHERE id = ?")
      .get(created.inquiry.id) as { tenant_token_hash: string };
    expect(row.tenant_token_hash).not.toBe(token);
    expect(verifyInquiryTokenHash(token, row.tenant_token_hash)).toBe(true);
    expect(verifyInquiryTokenHash("wrong-token", row.tenant_token_hash)).toBe(false);

    expect(getInquiryByTenantToken(db, token).ok).toBe(true);
    await submitInquiry(db, { rawToken: token, submission });

    const detail = getInquiry(db, workspaceId, created.inquiry.id);
    expect(detail.inquiry.status).toBe("SUBMITTED");
    expect(detail.guarantors).toHaveLength(1);
    await expect(submitInquiry(db, { rawToken: token, submission })).rejects.toThrow(
      /already been submitted/i,
    );
    expect(getInquiryByTenantToken(db, "not-a-real-token").ok).toBe(false);
  });
});

describe("review and landlord decision order", () => {
  async function submittedInquiry(db: DatabaseSync) {
    const fixture = seedLandlordAndProperty(db);
    const created = createInquiry(db, {
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      userLabel: "Dana Owner",
      propertyId: fixture.property.id,
      applicantName: "Priya Raman",
      applicantEmail: "priya@example.com",
      applicantPhone: "+1 512 555 0101",
    });
    const token = created.link.split("/inquiry/")[1];
    await submitInquiry(db, { rawToken: token, submission });
    return { ...fixture, inquiryId: created.inquiry.id, token };
  }

  it("cannot forward before lawyer approval and cannot decide twice", async () => {
    const db = makeDb();
    const { userId, workspaceId, inquiryId } = await submittedInquiry(db);

    expect(() =>
      forwardToLandlord(db, { workspaceId, inquiryId, actor: { id: userId, label: "Dana" } }),
    ).toThrow(/approve the inquiry/i);

    reviewInquiry(db, {
      workspaceId,
      inquiryId,
      decision: "approve",
      note: "Looks good.",
      actor: { id: userId, label: "Dana Owner" },
    });
    const forwarded = forwardToLandlord(db, {
      workspaceId,
      inquiryId,
      actor: { id: userId, label: "Dana Owner" },
    });
    const landlordToken = forwarded.link.split("/landlord/")[1];
    expect(getInquiryByLandlordToken(db, landlordToken).ok).toBe(true);

    expect(() =>
      landlordDecision(db, { rawToken: landlordToken, decision: "decline" }),
    ).toThrow(/reason for declining/i);

    landlordDecision(db, {
      rawToken: landlordToken,
      decision: "approve",
      comment: "Happy to proceed.",
    });
    expect(getInquiry(db, workspaceId, inquiryId).inquiry.status).toBe("LANDLORD_APPROVED");
    expect(() =>
      landlordDecision(db, { rawToken: landlordToken, decision: "approve" }),
    ).toThrow(/already been decided/i);
  });

  it("requires a landlord approval before preparing an agreement", async () => {
    const db = makeDb();
    const { userId, workspaceId, inquiryId } = await submittedInquiry(db);
    reviewInquiry(db, {
      workspaceId,
      inquiryId,
      decision: "approve",
      actor: { id: userId, label: "Dana Owner" },
    });
    await expect(
      createAgreementFromPrecedent(db, {
        workspaceId,
        userId,
        userLabel: "Dana Owner",
        userEmail: "dana@example.com",
        inquiryId,
        precedentId: "residential-tenancy",
        startDate: "2026-12-01",
        endDate: "2027-11-30",
      }),
    ).rejects.toThrow(/landlord must approve/i);
  });
});

describe("editable records", () => {
  it("creates, updates and deletes property units with unique numbers", () => {
    const db = makeDb();
    const { userId, workspaceId, landlord, property } = seedLandlordAndProperty(db);
    const actor = { id: userId, label: "Dana Owner" };

    const units = createUnitsBulk(db, {
      workspaceId,
      propertyId: property.id,
      actor,
      units: [
        { unitNumber: "1", unitType: "Flat", bedrooms: 1, rentAmountCents: 120_000 },
        { unitNumber: "2", unitType: "Flat", bedrooms: 2, rentAmountCents: 150_000 },
      ],
    });
    expect(units).toHaveLength(2);
    expect(listUnits(db, workspaceId, property.id)).toHaveLength(2);
    expect(() =>
      createUnitsBulk(db, {
        workspaceId,
        propertyId: property.id,
        actor,
        units: [{ unitNumber: "1", unitType: "Flat", bedrooms: 1, rentAmountCents: 100_000 }],
      }),
    ).toThrow(/already exists/i);

    const updated = updateUnit(db, {
      workspaceId,
      unitId: units[0].id,
      actor,
      unitNumber: "1A",
      unitType: "Studio",
      bedrooms: 1,
      occupancyStatus: "occupied",
      rentAmountCents: 130_000,
    });
    expect(updated.unit_number).toBe("1A");
    expect(updated.occupancy_status).toBe("occupied");

    deleteUnit(db, { workspaceId, unitId: units[1].id, actor });
    expect(listUnits(db, workspaceId, property.id)).toHaveLength(1);

    updateProperty(db, {
      workspaceId,
      propertyId: property.id,
      actor,
      landlordId: landlord.id,
      reference: property.reference,
      name: "12 Oak Street (rear)",
      category: "Residential",
      propertyType: "Duplex",
      addressLine1: property.address_line1,
      city: property.city,
      state: property.state,
      bedrooms: 4,
      rentAmountCents: 300_000,
    });
    expect(listProperties(db, workspaceId)[0].property_type).toBe("Duplex");

    deleteProperty(db, { workspaceId, propertyId: property.id, actor });
    expect(listProperties(db, workspaceId)).toHaveLength(0);
    expect(listUnits(db, workspaceId)).toHaveLength(0);
  });

  it("updates landlords and blocks deletion while properties remain", () => {
    const db = makeDb();
    const { userId, workspaceId, landlord, property } = seedLandlordAndProperty(db);
    const actor = { id: userId, label: "Dana Owner" };

    const updated = updateLandlord(db, {
      workspaceId,
      landlordId: landlord.id,
      actor,
      name: "Amara Okafor-Reyes",
      email: "amara@example.com",
      phone: "+1 512 555 0199",
      notes: "Prefers email.",
      idType: "National ID",
      idNumber: "NG-99881",
      lawFirmName: "Okafor & Co.",
      lawFirmEmail: "legal@okafor.example",
    });
    expect(updated.name).toBe("Amara Okafor-Reyes");
    expect(updated.law_firm_name).toBe("Okafor & Co.");

    expect(() => deleteLandlord(db, { workspaceId, landlordId: landlord.id, actor })).toThrow(
      /properties/i,
    );

    deleteProperty(db, { workspaceId, propertyId: property.id, actor });
    deleteLandlord(db, { workspaceId, landlordId: landlord.id, actor });
    expect(listLandlords(db, workspaceId)).toHaveLength(0);
  });

  it("edits an inquiry's unit and deletes it before an agreement exists", async () => {
    const db = makeDb();
    const { userId, workspaceId, property } = seedLandlordAndProperty(db);
    const actor = { id: userId, label: "Dana Owner" };
    const [unit] = createUnitsBulk(db, {
      workspaceId,
      propertyId: property.id,
      actor,
      units: [{ unitNumber: "3B", unitType: "Flat", bedrooms: 2, rentAmountCents: 175_000 }],
    });
    const created = createInquiry(db, {
      workspaceId,
      userId,
      userLabel: "Dana Owner",
      propertyId: property.id,
      applicantName: "Priya Raman",
      applicantEmail: "priya@example.com",
      applicantPhone: "+1 512 555 0101",
    });

    const updated = updateInquiry(db, {
      workspaceId,
      inquiryId: created.inquiry.id,
      name: "Priya R. Raman",
      email: "priya.raman@example.com",
      phone: "+1 512 555 0111",
      unitId: unit.id,
      lawyerNote: "Called to confirm the unit.",
      actor,
    });
    expect(updated.applicant_name).toBe("Priya R. Raman");
    expect(updated.unit_id).toBe(unit.id);
    expect(listInquiries(db, workspaceId)[0].unit_number).toBe("3B");

    deleteInquiry(db, { workspaceId, inquiryId: created.inquiry.id, actor });
    expect(listInquiries(db, workspaceId)).toHaveLength(0);
  });

  it("updates and deletes recorded payments", () => {
    const db = makeDb();
    const { userId, workspaceId } = seedLandlordAndProperty(db);
    const actor = { id: userId, label: "Dana Owner" };
    const payment = createPayment(db, {
      workspaceId,
      userId,
      userLabel: "Dana Owner",
      description: "November rent",
      amountCents: 285_000,
      dueDate: "2026-11-01",
    });

    const updated = updatePayment(db, {
      workspaceId,
      paymentId: payment.id,
      description: "November rent (revised)",
      amountCents: 290_000,
      dueDate: "2026-11-05",
      actor,
    });
    expect(updated.description).toBe("November rent (revised)");
    expect(updated.amount_cents).toBe(290_000);

    deletePayment(db, { workspaceId, paymentId: payment.id, actor });
    expect(listPayments(db, workspaceId)).toHaveLength(0);
  });
});

describe("sequential signing orders", () => {
  it("invites only the earliest signing order on a sequential document", async () => {
    const db = makeDb();
    const { userId, workspaceId } = seedWorkspace(db);
    const documentId = addDocument(db, workspaceId, { status: "DRAFT" });
    db.prepare("UPDATE documents SET signing_mode = 'sequential' WHERE id = ?").run(documentId);

    const recipients = [1, 2, 3].map((order, index) => {
      const id = `rcp_seq_${index}`;
      const now = nowIso();
      db.prepare(
        `INSERT INTO recipients
          (id, document_id, name, email, email_normalized, role, signing_order, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'signer', ?, 'PENDING', ?, ?)`,
      ).run(
        id,
        documentId,
        `Signer ${order}`,
        `signer${order}@example.com`,
        `signer${order}@example.com`,
        order,
        now,
        now,
      );
      db.prepare(
        `INSERT INTO fields
          (id, document_id, page_index, type, label, recipient_id, required, x, y, width, height, rotation, created_at, updated_at)
         VALUES (?, ?, 0, 'signature', 'Signature', ?, 1, 0.1, 0.1, 0.2, 0.05, 0, ?, ?)`,
      ).run(newId("fld"), documentId, id, now, now);
      return id;
    });

    const sent = await sendDocument(db, {
      documentId,
      workspaceId,
      actor: { id: userId, label: "Dana Owner", email: "dana@example.com" },
      expiresInDays: 14,
    });

    expect(sent.links).toHaveLength(1);
    expect(sent.links[0].email).toBe("signer1@example.com");
    const rows = db
      .prepare("SELECT id, status, token_hash FROM recipients WHERE document_id = ? ORDER BY signing_order")
      .all(documentId) as unknown as Array<{ id: string; status: string; token_hash: string | null }>;
    expect(rows.map((row) => row.status)).toEqual(["INVITED", "PENDING", "PENDING"]);
    expect(hashToken(sent.links[0].link.split("/sign/")[1])).toBe(rows[0].token_hash);
    expect(typeof addDaysIso(1)).toBe("string");
  });
});

describe("inquiry fee and passport photo", () => {
  function seedFeeProperty(db: DatabaseSync, inquiryFeeCents: number) {
    const fixture = seedLandlordAndProperty(db);
    const property = createProperty(db, {
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      userLabel: "Dana Owner",
      landlordId: fixture.landlord.id,
      reference: "FEE-1",
      name: "1 Fee Street",
      propertyType: "Apartment",
      addressLine1: "1 Fee Street",
      city: "Austin",
      state: "TX",
      bedrooms: 2,
      rentAmountCents: 300_000,
      inquiryFeeCents,
    });
    return { ...fixture, property };
  }

  it("uses the property fee by default and honors a per-client override", () => {
    const db = makeDb();
    const { userId, workspaceId, property } = seedFeeProperty(db, 50_000);

    const defaulted = createInquiry(db, {
      workspaceId,
      userId,
      userLabel: "Dana Owner",
      propertyId: property.id,
      applicantName: "Priya Raman",
      applicantEmail: "priya@example.com",
      applicantPhone: "+1 512 555 0101",
    });
    expect(defaulted.inquiry.inquiry_fee_cents).toBeNull();
    expect(inquiryFeeCentsFor(defaulted.inquiry, property)).toBe(50_000);

    const overridden = createInquiry(db, {
      workspaceId,
      userId,
      userLabel: "Dana Owner",
      propertyId: property.id,
      applicantName: "Ada Bello",
      applicantEmail: "ada@example.com",
      applicantPhone: "+234 803 555 0101",
      inquiryFeeCents: 10_000,
    });
    expect(overridden.inquiry.inquiry_fee_cents).toBe(10_000);
    expect(inquiryFeeCentsFor(overridden.inquiry, property)).toBe(10_000);

    const waived = createInquiry(db, {
      workspaceId,
      userId,
      userLabel: "Dana Owner",
      propertyId: property.id,
      applicantName: "No Fee",
      applicantEmail: "nofee@example.com",
      applicantPhone: "+234 803 555 0102",
      inquiryFeeCents: 0,
    });
    expect(inquiryFeeCentsFor(waived.inquiry, property)).toBe(0);
  });

  it("allows the lawyer to change the fee on a draft and charges the override", async () => {
    const db = makeDb();
    const { userId, workspaceId, property } = seedFeeProperty(db, 50_000);
    const created = createInquiry(db, {
      workspaceId,
      userId,
      userLabel: "Dana Owner",
      propertyId: property.id,
      applicantName: "Priya Raman",
      applicantEmail: "priya@example.com",
      applicantPhone: "+1 512 555 0101",
    });
    const token = created.link.split("/inquiry/")[1];

    updateInquiry(db, {
      workspaceId,
      inquiryId: created.inquiry.id,
      name: "Priya Raman",
      email: "priya@example.com",
      phone: "+1 512 555 0101",
      inquiryFeeCents: 0,
      actor: { id: userId, label: "Dana Owner" },
    });
    const detail = getInquiry(db, workspaceId, created.inquiry.id);
    expect(inquiryFeeCentsFor(detail.inquiry, detail.property)).toBe(0);

    await submitInquiry(db, { rawToken: token, submission });
    const submitted = getInquiry(db, workspaceId, created.inquiry.id);
    expect(submitted.inquiry.status).toBe("SUBMITTED");
    expect(submitted.inquiry.payment_fee_cents).toBe(0);
    expect(submitted.inquiry.payment_status).toBe("not_required");
  });

  it("validates and stores a passport photograph privately", async () => {
    const db = makeDb();
    const { userId, workspaceId, property } = seedFeeProperty(db, 0);
    const created = createInquiry(db, {
      workspaceId,
      userId,
      userLabel: "Dana Owner",
      propertyId: property.id,
      applicantName: "Priya Raman",
      applicantEmail: "priya@example.com",
      applicantPhone: "+1 512 555 0101",
    });
    const token = created.link.split("/inquiry/")[1];
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const photo = parsePassportPhotoDataUrl(dataUrl);

    await submitInquiry(db, { rawToken: token, submission, passportPhoto: photo });
    const detail = getInquiry(db, workspaceId, created.inquiry.id);
    expect(detail.files).toHaveLength(1);
    expect(detail.files[0].kind).toBe("passport_photo");
    expect(detail.files[0].mime).toBe("image/png");
    expect(detail.files[0].storage_key.startsWith(`${workspaceId}/`)).toBe(true);

    expect(() => parsePassportPhotoDataUrl("data:image/gif;base64,R0lGODlhAQABAAAAACw=")).toThrow(
      /PNG or JPEG/,
    );
  });

  it("embeds the passport photo in the summary PDF", async () => {
    const db = makeDb();
    const { userId, workspaceId, property } = seedFeeProperty(db, 0);
    const created = createInquiry(db, {
      workspaceId,
      userId,
      userLabel: "Dana Owner",
      propertyId: property.id,
      applicantName: "Priya Raman",
      applicantEmail: "priya@example.com",
      applicantPhone: "+1 512 555 0101",
    });
    const token = created.link.split("/inquiry/")[1];
    const photo = parsePassportPhotoDataUrl(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    );
    await submitInquiry(db, { rawToken: token, submission, passportPhoto: photo });

    const detail = getInquiry(db, workspaceId, created.inquiry.id);
    const bytes = await getInquirySummaryPdf(db, {
      inquiry: detail.inquiry,
      property: detail.property,
      unit: detail.unit,
      landlord: detail.landlord,
      guarantors: detail.guarantors,
      workspaceName: "Hart & Lane",
    });

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    let images = 0;
    for (const page of pdf.getPages()) {
      const xobjects = page.node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
      if (!xobjects) continue;
      for (const [, ref] of xobjects.entries()) {
        const stream = pdf.context.lookup(ref);
        if (
          stream instanceof PDFRawStream &&
          stream.dict.get(PDFName.of("Subtype"))?.toString() === "/Image"
        ) {
          images += 1;
        }
      }
    }
    expect(images).toBeGreaterThan(0);
  });

  it("rejects changing the fee after submission", async () => {
    const db = makeDb();
    const { userId, workspaceId, property } = seedFeeProperty(db, 0);
    const created = createInquiry(db, {
      workspaceId,
      userId,
      userLabel: "Dana Owner",
      propertyId: property.id,
      applicantName: "Priya Raman",
      applicantEmail: "priya@example.com",
      applicantPhone: "+1 512 555 0101",
    });
    const token = created.link.split("/inquiry/")[1];
    await submitInquiry(db, { rawToken: token, submission });

    expect(() =>
      updateInquiry(db, {
        workspaceId,
        inquiryId: created.inquiry.id,
        name: "Priya Raman",
        email: "priya@example.com",
        phone: "+1 512 555 0101",
        inquiryFeeCents: 0,
        actor: { id: userId, label: "Dana Owner" },
      }),
    ).toThrow(/still a draft/i);
  });
});
