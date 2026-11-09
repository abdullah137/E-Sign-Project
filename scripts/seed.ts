import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDb } from "../src/lib/db";
import { env } from "../src/lib/env";
import { registerUser } from "../src/lib/account";
import { hashPassword } from "../src/lib/password";
import { newId, nowIso, normalizeEmail } from "../src/lib/ids";
import { createDraftDocument, sendDocument } from "../src/lib/documents";
import { getPlan } from "../src/lib/plans";
import {
  createAgreementFromPrecedent,
  createInquiry,
  createLandlord,
  createPayment,
  createProperty,
  forwardToLandlord,
  landlordDecision,
  listPayments,
  markPaymentPaid,
  reviewInquiry,
  submitInquiry,
  type InquirySubmission,
} from "../src/lib/tenancy";

const DEMO_EMAIL = "demo@juripass.test";
const TEAMMATE_EMAIL = "maya@juripass.test";
const PASSWORD = "Juripass2026!";
const WORKSPACE_NAME = "Hart & Lane";
const reset = process.argv.includes("--reset");

interface SeedField {
  recipientId: string;
  pageIndex: number;
  type: string;
  label?: string | null;
  required?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

function insertRecipient(
  db: ReturnType<typeof getDb>,
  documentId: string,
  input: { id?: string; name: string; email: string; order: number },
): string {
  const id = input.id ?? newId("rcp");
  const now = nowIso();
  db.prepare(
    `INSERT INTO recipients
      (id, document_id, name, email, email_normalized, role, signing_order, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'signer', ?, 'PENDING', ?, ?)`,
  ).run(id, documentId, input.name, input.email, normalizeEmail(input.email), input.order, now, now);
  return id;
}

function insertFields(
  db: ReturnType<typeof getDb>,
  documentId: string,
  fields: SeedField[],
): void {
  const now = nowIso();
  for (const field of fields) {
    db.prepare(
      `INSERT INTO fields
        (id, document_id, page_index, type, label, recipient_id, required, x, y, width, height, rotation, font_size, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
    ).run(
      newId("fld"),
      documentId,
      field.pageIndex,
      field.type,
      field.label ?? null,
      field.recipientId,
      field.required === false ? 0 : 1,
      field.x,
      field.y,
      field.width,
      field.height,
      now,
      now,
    );
  }
}

async function buildPdf(options: {
  title: string;
  subtitle: string;
  body: string[];
  pageCount: number;
  signatureLabels: string[][];
}): Promise<{ bytes: Buffer; pageCount: number }> {
  const doc = await PDFDocument.create();
  doc.setTitle(options.title);
  doc.setAuthor("Hart & Lane");
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const gold = rgb(0.72, 0.58, 0.345);
  const ink = rgb(0.071, 0.078, 0.09);
  const slate = rgb(0.37, 0.4, 0.45);
  const hairline = rgb(0.85, 0.86, 0.87);

  for (let pageIndex = 0; pageIndex < options.pageCount; pageIndex += 1) {
    const page = doc.addPage([612, 792]);
    page.drawRectangle({ x: 54, y: 734, width: 504, height: 3, color: gold });
    page.drawText("HART & LANE", {
      x: 54,
      y: 750,
      size: 11,
      font: sansBold,
      color: ink,
    });
    page.drawText(pageIndex === 0 ? options.subtitle : `${options.title} — continued`, {
      x: 400,
      y: 751,
      size: 8.5,
      font: sans,
      color: slate,
    });

    if (pageIndex === 0) {
      page.drawText(options.title, {
        x: 54,
        y: 680,
        size: 25,
        font: serifBold,
        color: ink,
      });
      const paragraphs = options.body;
      let y = 640;
      paragraphs.forEach((paragraph, index) => {
        if (index === 3) {
          y -= 10;
          page.drawText(`${index + 1}. ${paragraph}`, {
            x: 54,
            y,
            size: 10,
            font: sansBold,
            color: ink,
          });
          y -= 18;
          return;
        }
        const words = paragraph.split(" ");
        let line = "";
        for (const word of words) {
          const next = line ? `${line} ${word}` : word;
          if (sans.widthOfTextAtSize(next, 10) > 500) {
            page.drawText(line, { x: 54, y, size: 10, font: sans, color: slate });
            y -= 16;
            line = word;
          } else {
            line = next;
          }
        }
        if (line) {
          page.drawText(line, { x: 54, y, size: 10, font: sans, color: slate });
          y -= 16;
        }
        y -= 10;
      });
    } else {
      page.drawText("Terms and conditions", {
        x: 54,
        y: 680,
        size: 19,
        font: serifBold,
        color: ink,
      });
      let y = 648;
      for (let section = 0; section < 6; section += 1) {
        page.drawText(`${pageIndex + 1}.${section + 1}  ${sectionTitle(section)}`, {
          x: 54,
          y,
          size: 10,
          font: sansBold,
          color: ink,
        });
        y -= 15;
        const filler =
          "The parties agree to perform their obligations with reasonable care, to keep confidential information secure, and to provide written notice of any material change that could affect the other party.";
        const words = filler.split(" ");
        let line = "";
        for (const word of words) {
          const next = line ? `${line} ${word}` : word;
          if (sans.widthOfTextAtSize(next, 9.5) > 500) {
            page.drawText(line, { x: 54, y, size: 9.5, font: sans, color: slate });
            y -= 14;
            line = word;
          } else {
            line = next;
          }
        }
        if (line) {
          page.drawText(line, { x: 54, y, size: 9.5, font: sans, color: slate });
          y -= 14;
        }
        y -= 16;
      }
    }

    const labels = options.signatureLabels[pageIndex] ?? ["Signature", "Date", "Name"];
    page.drawLine({
      start: { x: 54, y: 118 },
      end: { x: 558, y: 118 },
      thickness: 0.6,
      color: hairline,
    });
    page.drawText("Signatures", { x: 54, y: 100, size: 9, font: sansBold, color: ink });
    const columnWidth = 150;
    labels.forEach((label, index) => {
      const x = 54 + index * (columnWidth + 15);
      page.drawLine({
        start: { x, y: 58 },
        end: { x: x + columnWidth, y: 58 },
        thickness: 0.7,
        color: slate,
      });
      page.drawText(label, { x, y: 46, size: 8, font: sans, color: slate });
    });
    page.drawText(`Page ${pageIndex + 1} of ${options.pageCount}`, {
      x: 512,
      y: 24,
      size: 8,
      font: sans,
      color: slate,
    });
  }

  const bytes = Buffer.from(await doc.save());
  return { bytes, pageCount: doc.getPageCount() };
}

function sectionTitle(section: number): string {
  return [
    "Confidentiality",
    "Scope of services",
    "Fees and payment",
    "Term and termination",
    "Liability",
    "Governing law",
  ][section] ?? "General";
}

async function ensureUser(
  db: ReturnType<typeof getDb>,
  input: { email: string; name: string; role: "owner" | "admin" | "member" },
  workspaceId?: string,
): Promise<{ userId: string; workspaceId: string }> {
  const existing = db
    .prepare("SELECT id FROM users WHERE email_normalized = ?")
    .get(normalizeEmail(input.email)) as { id: string } | undefined;
  if (existing) {
    if (!workspaceId) throw new Error(`${input.email} already exists but no workspace was supplied.`);
    const membership = db
      .prepare("SELECT id FROM memberships WHERE user_id = ? AND workspace_id = ?")
      .get(existing.id, workspaceId);
    if (!membership) {
      db.prepare(
        `INSERT INTO memberships (id, workspace_id, user_id, role, status, created_at)
         VALUES (?, ?, ?, ?, 'active', ?)`,
      ).run(newId("mem"), workspaceId, existing.id, input.role, nowIso());
    }
    return { userId: existing.id, workspaceId };
  }

  if (!workspaceId) {
    const { user, workspaceId: createdWorkspace } = registerUser(db, {
      fullName: input.name,
      email: input.email,
      password: PASSWORD,
      workspaceName: WORKSPACE_NAME,
    });
    db.prepare("UPDATE users SET email_verified_at = ? WHERE id = ?").run(nowIso(), user.id);
    return { userId: user.id, workspaceId: createdWorkspace };
  }

  const userId = newId("usr");
  const now = nowIso();
  db.prepare(
    `INSERT INTO users (id, full_name, email, email_normalized, password_hash, email_verified_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    userId,
    input.name,
    input.email.trim(),
    normalizeEmail(input.email),
    hashPassword(PASSWORD),
    now,
    now,
    now,
  );
  db.prepare(
    `INSERT INTO memberships (id, workspace_id, user_id, role, status, created_at)
     VALUES (?, ?, ?, ?, 'active', ?)`,
  ).run(newId("mem"), workspaceId, userId, input.role, now);
  return { userId, workspaceId };
}

async function main() {
  const db = getDb();
  const existingDemo = db
    .prepare("SELECT u.id, w.id AS workspace_id FROM users u JOIN memberships m ON m.user_id = u.id JOIN workspaces w ON w.id = m.workspace_id WHERE u.email_normalized = ? LIMIT 1")
    .get(normalizeEmail(DEMO_EMAIL)) as { id: string; workspace_id: string } | undefined;

  if (existingDemo) {
    if (!reset) {
      console.log(`Seed data already exists for ${DEMO_EMAIL}.`);
      console.log("Run `npm run seed -- --reset` to recreate the demo workspace.");
      process.exit(0);
    }
    const workspaceId = existingDemo.workspace_id;
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("DELETE FROM email_outbox WHERE payload_json LIKE ?").run(`%${workspaceId}%`);
      db.prepare("DELETE FROM audit_events WHERE workspace_id = ?").run(workspaceId);
      db.prepare("DELETE FROM workspaces WHERE id = ?").run(workspaceId);
      const demo = db.prepare("SELECT id FROM users WHERE email_normalized = ?").get(normalizeEmail(DEMO_EMAIL)) as
        | { id: string }
        | undefined;
      const teammate = db
        .prepare("SELECT id FROM users WHERE email_normalized = ?")
        .get(normalizeEmail(TEAMMATE_EMAIL)) as { id: string } | undefined;
      if (demo) db.prepare("DELETE FROM users WHERE id = ?").run(demo.id);
      if (teammate) db.prepare("DELETE FROM users WHERE id = ?").run(teammate.id);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    console.log("Removed the previous demo workspace.");
  }

  const owner = await ensureUser(db, { email: DEMO_EMAIL, name: "Daniel Okafor", role: "owner" });
  const workspaceId = owner.workspaceId;
  await ensureUser(db, { email: TEAMMATE_EMAIL, name: "Maya Chen", role: "admin" }, workspaceId);

  const plan = getPlan("starter");
  db.prepare(
    "UPDATE workspaces SET name = ?, plan = ?, brand_display_name = ?, brand_color = ? WHERE id = ?",
  ).run(WORKSPACE_NAME, plan.id, WORKSPACE_NAME, "#2563EB", workspaceId);
  db.prepare(
    `INSERT INTO subscriptions (workspace_id, plan, status, renews_at, updated_at)
     VALUES (?, ?, 'active', ?, ?)
     ON CONFLICT(workspace_id) DO UPDATE SET plan = excluded.plan, status = 'active', renews_at = excluded.renews_at, updated_at = excluded.updated_at`,
  ).run(workspaceId, plan.id, new Date(Date.now() + 30 * 86_400_000).toISOString(), nowIso());
  db.prepare(
    "INSERT INTO invoices (id, workspace_id, plan, amount_cents, status, issued_at) VALUES (?, ?, ?, ?, 'paid', ?)",
  ).run(newId("inv"), workspaceId, plan.id, Math.round(plan.priceMonthly * 100), nowIso());

  const tenancyPdf = await buildPdf({
    title: "Residential tenancy agreement",
    subtitle: "21 Elm Court · Draft",
    body: [
      "This residential tenancy agreement is entered into between Amara Okafor, as landlord, and Lena Fischer, as tenant, for the property at 21 Elm Court, Austin, Texas.",
      "The tenancy begins on 1 December 2026 and continues for twelve months unless ended in accordance with this agreement or applicable law.",
      "Rent is payable monthly in advance. The tenant will keep the property in good condition, report repairs promptly and observe the building rules.",
      "Obligations",
      "The landlord will maintain the structure, installations and common areas, return the deposit subject to a documented schedule, and give notice of any inspection.",
    ],
    pageCount: 2,
    signatureLabels: [
      ["Tenant", "Date", "Name"],
      ["Landlord", "Date", "Initials"],
    ],
  });

  const harbourPdf = await buildPdf({
    title: "Residential tenancy agreement",
    subtitle: "4 Harbour View · Hart & Lane",
    body: [
      "This residential tenancy agreement covers the property at 4 Harbour View, Portland, Oregon, made between Northwind Holdings and Priya Raman.",
      "The tenancy runs for twelve months from the start date recorded on the signing page. Rent and the deposit are set out in the schedule.",
      "The tenant will use the property as a private residence, keep it clean and report any damage or required repair without delay.",
      "Guarantee",
      "A guarantor may be asked to acknowledge the tenancy. Any guarantee is recorded separately and does not change the tenant's obligations.",
    ],
    pageCount: 1,
    signatureLabels: [["Tenant", "Guarantor", "Landlord"]],
  });

  const leasePdf = await buildPdf({
    title: "Company lease",
    subtitle: "Unit 7, Kingsway · Northwind Holdings",
    body: [
      "This company lease lets Unit 7, Kingsway Business Park to Northwind Holdings for use as an office, on the terms set out below.",
      "The tenant will pay rent quarterly in advance, maintain appropriate insurance and comply with the park's operating rules.",
      "Either party may terminate for material breach after written notice and a reasonable opportunity to remedy the breach.",
      "Permitted use",
      "The premises may be used for office and light administrative work only. Any change of use requires the landlord's written consent.",
    ],
    pageCount: 2,
    signatureLabels: [
      ["Tenant", "Landlord", "Date"],
      ["Tenant", "Landlord", "Date"],
    ],
  });

  const now = nowIso();
  const drafts = [
    {
      title: "Residential tenancy — 21 Elm Court",
      message: "Draft for Lena Fischer. Review the clauses before sending.",
      pdf: tenancyPdf,
      fileName: "residential-tenancy-21-elm.pdf",
      pageCount: tenancyPdf.pageCount,
    },
    {
      title: "Residential tenancy — 4 Harbour View",
      message: "Prepared for Priya Raman. Signature and date only.",
      pdf: harbourPdf,
      fileName: "residential-tenancy-4-harbour.pdf",
      pageCount: harbourPdf.pageCount,
    },
    {
      title: "Company lease — Unit 7, Kingsway",
      message: "Both signatories are on this copy. Thank you.",
      pdf: leasePdf,
      fileName: "company-lease-kingsway.pdf",
      pageCount: leasePdf.pageCount,
    },
  ];

  console.log("\nSigning links");
  console.log("─".repeat(72));

  for (const entry of drafts) {
    const doc = await createDraftDocument(db, {
      workspaceId,
      userId: owner.userId,
      userLabel: "Daniel Okafor",
      title: entry.title,
      fileName: entry.fileName,
      bytes: entry.pdf.bytes,
      pageCount: entry.pageCount,
    });
    db.prepare("UPDATE documents SET message = ? WHERE id = ?").run(entry.message, doc.id);

    if (entry.title.startsWith("Residential tenancy — 21")) {
      const rcp = insertRecipient(db, doc.id, {
        name: "Lena Fischer",
        email: "lena.fischer@example.com",
        order: 1,
      });
      insertFields(db, doc.id, [
        { recipientId: rcp, pageIndex: 0, type: "signature", label: "Signature", x: 0.1, y: 0.86, width: 0.26, height: 0.055 },
        { recipientId: rcp, pageIndex: 0, type: "name", label: "Full name", x: 0.1, y: 0.81, width: 0.24, height: 0.032 },
        { recipientId: rcp, pageIndex: 0, type: "date", label: "Date", x: 0.1, y: 0.76, width: 0.16, height: 0.032 },
        { recipientId: rcp, pageIndex: 1, type: "initials", label: "Initials", x: 0.1, y: 0.86, width: 0.11, height: 0.042 },
        { recipientId: rcp, pageIndex: 1, type: "checkbox", label: "I have read the terms", x: 0.1, y: 0.8, width: 0.024, height: 0.024, required: false },
      ]);
      console.log(`  Draft   ${entry.title}`);
      continue;
    }

    if (entry.title.startsWith("Residential tenancy — 4")) {
      const rcp = insertRecipient(db, doc.id, {
        name: "Priya Raman",
        email: "priya.raman@example.com",
        order: 1,
      });
      insertFields(db, doc.id, [
        { recipientId: rcp, pageIndex: 0, type: "signature", label: "Signature", x: 0.1, y: 0.86, width: 0.26, height: 0.055 },
        { recipientId: rcp, pageIndex: 0, type: "name", label: "Full name", x: 0.1, y: 0.81, width: 0.24, height: 0.032 },
        { recipientId: rcp, pageIndex: 0, type: "date", label: "Date", x: 0.1, y: 0.76, width: 0.16, height: 0.032 },
      ]);
      const sent = await sendDocument(db, {
        documentId: doc.id,
        workspaceId,
        actor: { id: owner.userId, label: "Daniel Okafor", email: DEMO_EMAIL },
        expiresInDays: 14,
      });
      for (const link of sent.links) {
        console.log(`  Pending ${entry.title} → ${link.name} <${link.email}>`);
        console.log(`          ${link.link}`);
      }
      continue;
    }

    const rcp1 = insertRecipient(db, doc.id, {
      name: "Theo Marsh",
      email: "theo@northwind.example",
      order: 1,
    });
    const rcp2 = insertRecipient(db, doc.id, {
      name: "Amara Okafor",
      email: "amara.okafor@example.com",
      order: 2,
    });
    insertFields(db, doc.id, [
      { recipientId: rcp1, pageIndex: 0, type: "signature", label: "Signature", x: 0.1, y: 0.86, width: 0.24, height: 0.05 },
      { recipientId: rcp1, pageIndex: 0, type: "date", label: "Date", x: 0.1, y: 0.81, width: 0.15, height: 0.032 },
      { recipientId: rcp2, pageIndex: 0, type: "signature", label: "Signature", x: 0.1, y: 0.7, width: 0.24, height: 0.05 },
      { recipientId: rcp2, pageIndex: 0, type: "date", label: "Date", x: 0.1, y: 0.65, width: 0.15, height: 0.032 },
      { recipientId: rcp1, pageIndex: 1, type: "initials", label: "Initials", x: 0.1, y: 0.86, width: 0.1, height: 0.04 },
      { recipientId: rcp2, pageIndex: 1, type: "initials", label: "Initials", x: 0.1, y: 0.8, width: 0.1, height: 0.04 },
    ]);
    const sent = await sendDocument(db, {
      documentId: doc.id,
      workspaceId,
      actor: { id: owner.userId, label: "Daniel Okafor", email: DEMO_EMAIL },
      expiresInDays: 14,
    });
    for (const link of sent.links) {
      console.log(`  Pending ${entry.title} → ${link.name} <${link.email}>`);
      console.log(`          ${link.link}`);
    }
  }

  db.prepare(
    "INSERT INTO invoices (id, workspace_id, plan, amount_cents, status, issued_at) VALUES (?, ?, ?, ?, 'paid', ?)",
  ).run(newId("inv"), workspaceId, "pro", 1900, new Date(Date.now() - 32 * 86_400_000).toISOString());

  console.log("\nTenancy demo");
  console.log("─".repeat(72));

  const okafor = createLandlord(db, {
    workspaceId,
    userId: owner.userId,
    userLabel: "Daniel Okafor",
    name: "Amara Okafor",
    email: "amara.okafor@example.com",
    phone: "+1 512 555 0142",
    notes: "Owns three rental units. Prefers to decide by email.",
  });
  const northwind = createLandlord(db, {
    workspaceId,
    userId: owner.userId,
    userLabel: "Daniel Okafor",
    name: "Theo Marsh",
    email: "theo@northwind.example",
    phone: "+1 503 555 0188",
    notes: "Northwind Holdings — office and residential portfolio.",
  });

  const oakStreet = createProperty(db, {
    workspaceId,
    userId: owner.userId,
    userLabel: "Daniel Okafor",
    landlordId: okafor.id,
    reference: "OAK-12",
    name: "12 Oak Street",
    propertyType: "House",
    addressLine1: "12 Oak Street",
    city: "Austin",
    state: "TX",
    postalCode: "78701",
    bedrooms: 3,
    rentAmountCents: 285_000,
    status: "available",
  });
  const harbourView = createProperty(db, {
    workspaceId,
    userId: owner.userId,
    userLabel: "Daniel Okafor",
    landlordId: northwind.id,
    reference: "HBR-4",
    name: "4 Harbour View",
    propertyType: "Apartment",
    addressLine1: "4 Harbour View",
    city: "Portland",
    state: "OR",
    postalCode: "97209",
    bedrooms: 2,
    rentAmountCents: 320_000,
    status: "available",
  });
  const kingsway = createProperty(db, {
    workspaceId,
    userId: owner.userId,
    userLabel: "Daniel Okafor",
    landlordId: northwind.id,
    reference: "KSW-7",
    name: "Unit 7, Kingsway",
    propertyType: "Office",
    addressLine1: "Kingsway Business Park, Unit 7",
    city: "Portland",
    state: "OR",
    postalCode: "97204",
    bedrooms: 0,
    rentAmountCents: 540_000,
    status: "maintenance",
  });

  const baseSubmission = (name: string): InquirySubmission => ({
    currentAddress: "18 Willow Lane, Austin, TX",
    currentCity: "Austin",
    currentState: "TX",
    reasonForMoving: "The current lease ends soon and the household needs a home closer to work.",
    maritalStatus: "Married",
    childrenCount: 1,
    employmentStatus: "Employed full-time",
    employer: "Brightline Health",
    occupation: "Nurse practitioner",
    incomeRange: "60,000 – 99,999",
    religionState: "Texas",
    notes: null,
    signatureName: name,
    guarantors: [
      { name: "Michael Fischer", email: "michael.fischer@example.com", relationship: "Father" },
    ],
  });

  async function submittedInquiry(input: {
    propertyId: string;
    name: string;
    email: string;
    phone: string;
    lawyerNote?: string | null;
    submission?: Partial<InquirySubmission>;
  }): Promise<{ id: string; link: string }> {
    const created = createInquiry(db, {
      workspaceId,
      userId: owner.userId,
      userLabel: "Daniel Okafor",
      propertyId: input.propertyId,
      applicantName: input.name,
      applicantEmail: input.email,
      applicantPhone: input.phone,
      lawyerNote: input.lawyerNote ?? null,
    });
    const token = created.link.split("/inquiry/")[1];
    await submitInquiry(db, {
      rawToken: token,
      submission: { ...baseSubmission(input.name), ...input.submission },
      ip: "127.0.0.1",
      userAgent: "Seed demo",
    });
    return { id: created.inquiry.id, link: created.link };
  }

  const awaitingForm = createInquiry(db, {
    workspaceId,
    userId: owner.userId,
    userLabel: "Daniel Okafor",
    propertyId: harbourView.id,
    applicantName: "Lena Fischer",
    applicantEmail: "lena.fischer@example.com",
    applicantPhone: "+1 512 555 0104",
    lawyerNote: "Send the form today; lease ends in six weeks.",
  });
  console.log(`  Draft inquiry   Lena Fischer → ${awaitingForm.link}`);

  await submittedInquiry({
    propertyId: oakStreet.id,
    name: "Priya Raman",
    email: "priya.raman@example.com",
    phone: "+1 512 555 0177",
    lawyerNote: "Strong application. Awaiting initial review.",
  });

  const landlordPending = await submittedInquiry({
    propertyId: oakStreet.id,
    name: "Daniel Mwangi",
    email: "daniel.mwangi@example.com",
    phone: "+1 512 555 0181",
    submission: { incomeRange: "100,000 – 149,999", childrenCount: 2 },
  });
  reviewInquiry(db, {
    workspaceId,
    inquiryId: landlordPending.id,
    decision: "approve",
    note: "Income and references check out. Forwarding to the landlord.",
    actor: { id: owner.userId, label: "Daniel Okafor" },
  });
  const landlordLink = forwardToLandlord(db, {
    workspaceId,
    inquiryId: landlordPending.id,
    actor: { id: owner.userId, label: "Daniel Okafor" },
  });
  console.log(`  Landlord review Daniel Mwangi → ${landlordLink.link}`);

  const approved = await submittedInquiry({
    propertyId: oakStreet.id,
    name: "Sofia Alvarez",
    email: "sofia.alvarez@example.com",
    phone: "+1 512 555 0192",
    submission: {
      maritalStatus: "Single",
      childrenCount: 0,
      employmentStatus: "Self-employed",
      employer: "Alvarez Studio",
      occupation: "Designer",
      incomeRange: "100,000 – 149,999",
      guarantors: [
        { name: "Elena Alvarez", email: "elena.alvarez@example.com", relationship: "Mother" },
      ],
    },
  });
  reviewInquiry(db, {
    workspaceId,
    inquiryId: approved.id,
    decision: "approve",
    note: "Approved. Guarantor details provided.",
    actor: { id: owner.userId, label: "Daniel Okafor" },
  });
  const approvedLink = forwardToLandlord(db, {
    workspaceId,
    inquiryId: approved.id,
    actor: { id: owner.userId, label: "Daniel Okafor" },
  });
  landlordDecision(db, {
    rawToken: approvedLink.link.split("/landlord/")[1],
    decision: "approve",
    comment: "Happy to proceed with Sofia. Please send the agreement for signature.",
    ip: "127.0.0.1",
    userAgent: "Seed demo",
  });
  const agreement = await createAgreementFromPrecedent(db, {
    workspaceId,
    userId: owner.userId,
    userLabel: "Daniel Okafor",
    userEmail: DEMO_EMAIL,
    inquiryId: approved.id,
    precedentId: "residential-tenancy",
    startDate: "2025-12-01",
    endDate: "2026-11-30",
  });
  const agreementLinks = await sendDocument(db, {
    documentId: agreement.documentId,
    workspaceId,
    actor: { id: owner.userId, label: "Daniel Okafor", email: DEMO_EMAIL },
    expiresInDays: 21,
  });
  for (const link of agreementLinks.links) {
    console.log(`  Signing order   ${agreement.documentId} → ${link.name} <${link.email}>`);
    console.log(`                  ${link.link}`);
  }

  const payments = listPayments(db, workspaceId);
  const firstRent = payments.find((payment) => payment.agreement_id === agreement.agreementId);
  if (firstRent) {
    markPaymentPaid(db, {
      workspaceId,
      paymentId: firstRent.id,
      method: "Bank transfer",
      note: "Cleared offline — reference OAK-12-1201.",
      actor: { id: owner.userId, label: "Daniel Okafor" },
    });
  }
  createPayment(db, {
    workspaceId,
    userId: owner.userId,
    userLabel: "Daniel Okafor",
    agreementId: agreement.agreementId,
    description: "Security deposit — 12 Oak Street",
    amountCents: 285_000,
    dueDate: "2026-11-20",
  });
  console.log(`  Agreement       ${agreement.agreementId} (rental + deposit recorded)`);

  const declinedByLandlord = await submittedInquiry({
    propertyId: harbourView.id,
    name: "Marcus Bell",
    email: "marcus.bell@example.com",
    phone: "+1 503 555 0126",
    submission: {
      currentAddress: "220 Cedar Avenue, Portland, OR",
      currentCity: "Portland",
      currentState: "OR",
      incomeRange: "40,000 – 59,999",
    },
  });
  reviewInquiry(db, {
    workspaceId,
    inquiryId: declinedByLandlord.id,
    decision: "approve",
    note: "Forwarding so the landlord can weigh the income range.",
    actor: { id: owner.userId, label: "Daniel Okafor" },
  });
  const declineLink = forwardToLandlord(db, {
    workspaceId,
    inquiryId: declinedByLandlord.id,
    actor: { id: owner.userId, label: "Daniel Okafor" },
  });
  landlordDecision(db, {
    rawToken: declineLink.link.split("/landlord/")[1],
    decision: "decline",
    comment: "Income is below the level we need for this property.",
    ip: "127.0.0.1",
    userAgent: "Seed demo",
  });

  const lawyerDeclined = await submittedInquiry({
    propertyId: kingsway.id,
    name: "Aisha Bello",
    email: "aisha.bello@example.com",
    phone: "+1 512 555 0139",
    submission: {
      employmentStatus: "Student",
      employer: null,
      occupation: "Postgraduate researcher",
      incomeRange: "Under 20,000",
      guarantors: [],
    },
  });
  reviewInquiry(db, {
    workspaceId,
    inquiryId: lawyerDeclined.id,
    decision: "decline",
    note: "No guarantor and the property is not currently available.",
    actor: { id: owner.userId, label: "Daniel Okafor" },
  });
  console.log("  Inquiries       6 seeded across draft, review, landlord and declined states");

  console.log("\n" + "─".repeat(72));
  console.log("Demo accounts");
  console.log(`  Owner   ${DEMO_EMAIL} / ${PASSWORD}`);
  console.log(`  Admin   ${TEAMMATE_EMAIL} / ${PASSWORD}`);
  console.log(`  Plan    ${plan.name}`);
  console.log(`  Data    ${path.resolve(env.dataDir)}`);
  console.log("─".repeat(72));
  console.log("Start the app with `npm run dev`, then sign in or open a public link above.\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
