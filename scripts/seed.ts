import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDb } from "../src/lib/db";
import { registerUser } from "../src/lib/account";
import { hashPassword } from "../src/lib/password";
import { newId, nowIso, normalizeEmail } from "../src/lib/ids";
import { createDraftDocument, sendDocument } from "../src/lib/documents";
import { getPlan } from "../src/lib/plans";

const DEMO_EMAIL = "demo@signflow.test";
const TEAMMATE_EMAIL = "maya@signflow.test";
const PASSWORD = "SignFlow2026!";
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
  doc.setAuthor("Hart & Co.");
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
    page.drawText("HART & CO.", {
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
      workspaceName: "Hart & Co.",
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

  const plan = getPlan("pro");
  db.prepare(
    "UPDATE workspaces SET name = ?, plan = ?, brand_display_name = ?, brand_color = ? WHERE id = ?",
  ).run("Hart & Co.", plan.id, "Hart & Co.", "#B89558", workspaceId);
  db.prepare(
    `INSERT INTO subscriptions (workspace_id, plan, status, renews_at, updated_at)
     VALUES (?, ?, 'active', ?, ?)
     ON CONFLICT(workspace_id) DO UPDATE SET plan = excluded.plan, status = 'active', renews_at = excluded.renews_at, updated_at = excluded.updated_at`,
  ).run(workspaceId, plan.id, new Date(Date.now() + 30 * 86_400_000).toISOString(), nowIso());
  db.prepare(
    "INSERT INTO invoices (id, workspace_id, plan, amount_cents, status, issued_at) VALUES (?, ?, ?, ?, 'paid', ?)",
  ).run(newId("inv"), workspaceId, plan.id, plan.priceMonthly * 100, nowIso());

  const consultingPdf = await buildPdf({
    title: "Consulting agreement",
    subtitle: "Prepared for Northwind Studio",
    body: [
      "This consulting agreement is entered into between Hart & Co. and Northwind Studio for design and research services beginning on 1 November 2026.",
      "The engagement covers product discovery, interface design and a written research summary. Work will be delivered in two phases, with a review at the end of each phase.",
      "Fees are billed monthly at the rate set out in the accompanying statement of work. Invoices are payable within fourteen days of receipt.",
      "Confidentiality",
      "Both parties will keep commercial and technical information confidential, use it only for the purposes of this engagement, and return or destroy it on request.",
    ],
    pageCount: 2,
    signatureLabels: [
      ["Northwind Studio", "Date", "Name"],
      ["Northwind Studio", "Date", "Initials"],
    ],
  });

  const ndaPdf = await buildPdf({
    title: "Mutual NDA",
    subtitle: "Northwind Studio · Confidential",
    body: [
      "This mutual non-disclosure agreement protects information exchanged between Hart & Co. and Northwind Studio while evaluating a potential collaboration.",
      "Each party may disclose business, product and technical information in written or oral form. The receiving party will protect it with at least reasonable care.",
      "The obligations survive for three years from the date of disclosure and do not apply to information that is publicly available or independently developed.",
      "Exclusions",
      "Confidential information does not include material the receiving party can show it already knew, received from a third party without restriction, or developed without reference to the disclosure.",
    ],
    pageCount: 1,
    signatureLabels: [["Northwind Studio", "Hart & Co.", "Date"]],
  });

  const vendorPdf = await buildPdf({
    title: "Vendor services agreement",
    subtitle: "Meridian Supply · Operations",
    body: [
      "This agreement sets out the terms under which Meridian Supply will provide fulfilment and logistics services to Hart & Co. from December 2026.",
      "Meridian will maintain accurate inventory records, dispatch orders within two business days, and notify Hart & Co. of any material disruption.",
      "Either party may terminate for convenience with thirty days' written notice. Fees for work completed remain payable.",
      "Insurance",
      "Meridian will maintain general liability and cargo insurance throughout the term and provide certificates on request.",
    ],
    pageCount: 2,
    signatureLabels: [
      ["Meridian Supply", "Hart & Co.", "Date"],
      ["Meridian Supply", "Hart & Co.", "Date"],
    ],
  });

  const now = nowIso();
  const drafts = [
    {
      title: "Consulting agreement — October",
      message: "Please review and sign before the kickoff call on Monday.",
      pdf: consultingPdf,
      fileName: "consulting-agreement.pdf",
      pageCount: consultingPdf.pageCount,
    },
    {
      title: "Mutual NDA — Northwind",
      message: "Sharing this before our product workshop. Signature only — no initials needed.",
      pdf: ndaPdf,
      fileName: "mutual-nda.pdf",
      pageCount: ndaPdf.pageCount,
    },
    {
      title: "Vendor services agreement — Meridian",
      message: "Both signatories are on this copy. Thank you.",
      pdf: vendorPdf,
      fileName: "vendor-services.pdf",
      pageCount: vendorPdf.pageCount,
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

    if (entry.title.startsWith("Consulting")) {
      const rcp = insertRecipient(db, doc.id, {
        name: "Amelia Hart",
        email: "amelia@northwind.studio",
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

    if (entry.title.startsWith("Mutual")) {
      const rcp = insertRecipient(db, doc.id, {
        name: "Amelia Hart",
        email: "amelia@northwind.studio",
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
      name: "Amelia Hart",
      email: "amelia@northwind.studio",
      order: 1,
    });
    const rcp2 = insertRecipient(db, doc.id, {
      name: "Jonas Weber",
      email: "jonas@meridian.supply",
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

  console.log("\n" + "─".repeat(72));
  console.log("Demo accounts");
  console.log(`  Owner   ${DEMO_EMAIL} / ${PASSWORD}`);
  console.log(`  Admin   ${TEAMMATE_EMAIL} / ${PASSWORD}`);
  console.log(`  Plan    ${plan.name}`);
  console.log(`  Data    ${path.join(process.cwd(), "data")}`);
  console.log("─".repeat(72));
  console.log("Start the app with `npm run dev`, then sign in or open a signing link.\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
