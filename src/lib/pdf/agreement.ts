import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { RESIDENTIAL_TENANCY, type Precedent } from "../precedents";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = rgb(0.051, 0.161, 0.302);
const SLATE = rgb(0.278, 0.333, 0.412);
const MUTED = rgb(0.392, 0.455, 0.545);
const NAVY = rgb(0.051, 0.161, 0.302);
const AMBER = rgb(0.98, 0.714, 0.255);
const HAIRLINE = rgb(0.875, 0.894, 0.922);

export interface AgreementPdfInput {
  precedent: Precedent;
  workspaceName: string;
  title: string;
  landlordName: string;
  landlordEmail: string;
  tenantName: string;
  tenantEmail: string;
  guarantors: Array<{ name: string; email: string; relationship?: string }>;
  propertyLabel: string;
  propertyAddress: string;
  rentLabel: string;
  monthlyRent?: string;
  annualRent?: string;
  startDate: string;
  endDate: string;
  jurisdiction: string;
  preparedBy: string;
  lawyer?: { name: string; email: string; firmName?: string | null } | null;
  logo?: { bytes: Uint8Array; mediaType: string } | null;
}

export interface SignaturePlacement {
  recipientKey: string;
  pageIndex: number;
  type: "signature" | "date";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AgreementPdfResult {
  bytes: Uint8Array;
  pageCount: number;
  placements: SignaturePlacement[];
  recipientKeys: string[];
}

function sanitize(value: string): string {
  return value
    .replace(/\u20A6/g, "NGN ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\xFF]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = sanitize(paragraph).split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function buildAgreementPdf(input: AgreementPdfInput): Promise<AgreementPdfResult> {
  if (input.precedent.id === "residential-tenancy") {
    return buildResidentialAgreementPdf(input);
  }
  return buildStandardAgreementPdf(input);
}

async function buildResidentialAgreementPdf(
  input: AgreementPdfInput,
): Promise<AgreementPdfResult> {
  const doc = await PDFDocument.create();
  doc.setTitle(RESIDENTIAL_TENANCY.documentTitle);
  doc.setAuthor(input.workspaceName);
  doc.setCreator("Juripass Sign Flow");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = input.logo
    ? await (input.logo.mediaType === "image/png"
        ? doc.embedPng(input.logo.bytes)
        : doc.embedJpg(input.logo.bytes)
      ).catch(() => null)
    : null;

  const pages: PDFPage[] = [];
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - MARGIN;
  };

  const ensure = (height: number) => {
    if (y - height < MARGIN + 34) newPage();
  };

  const centered = (value: string, size: number, font: PDFFont, color = INK) => {
    const clean = sanitize(value);
    const width = font.widthOfTextAtSize(clean, size);
    page.drawText(clean, { x: (PAGE_WIDTH - width) / 2, y, size, font, color });
  };

  const paragraph = (
    value: string,
    options: {
      size?: number;
      font?: PDFFont;
      color?: typeof INK;
      indent?: number;
      leading?: number;
    } = {},
  ) => {
    const size = options.size ?? 10.5;
    const font = options.font ?? regular;
    const indent = options.indent ?? 0;
    const leading = options.leading ?? size * 1.55;
    for (const line of wrap(value, font, size, CONTENT_WIDTH - indent)) {
      ensure(leading);
      page.drawText(line, { x: MARGIN + indent, y, size, font, color: options.color ?? SLATE });
      y -= leading;
    }
  };

  const heading = (value: string) => {
    ensure(26);
    paragraph(value, { font: bold, color: INK });
    y -= 2;
  };

  const list = (items: string[], markers: string[]) => {
    const indent = 30;
    const leading = 16;
    items.forEach((item, index) => {
      const lines = wrap(item, regular, 10.5, CONTENT_WIDTH - indent);
      if (y - (lines.length * leading + 6) < MARGIN + 34) newPage();
      page.drawText(markers[index] ?? `${index + 1}.`, {
        x: MARGIN,
        y,
        size: 10.5,
        font: regular,
        color: SLATE,
      });
      for (const line of lines) {
        page.drawText(line, { x: MARGIN + indent, y, size: 10.5, font: regular, color: SLATE });
        y -= leading;
      }
      y -= 5;
    });
  };

  if (logo) {
    const scale = Math.min(150 / logo.width, 36 / logo.height, 1);
    const width = logo.width * scale;
    const height = logo.height * scale;
    page.drawImage(logo, { x: (PAGE_WIDTH - width) / 2, y: y - height, width, height });
    y -= height + 14;
  }
  centered(input.landlordName.toUpperCase(), 12.5, bold, INK);
  y -= 20;
  centered(RESIDENTIAL_TENANCY.documentTitle, 12, bold, INK);
  y -= 10;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.7,
    color: HAIRLINE,
  });
  y -= 24;

  paragraph(
    `THIS TENANCY AGREEMENT is made on ${input.startDate} BETWEEN ${input.landlordName} (hereinafter called "the Landlord") AND ${input.tenantName}, ${input.tenantEmail} (hereinafter called "the Tenant") of the other part.`,
  );
  y -= 10;

  heading("WHEREAS:");
  list(
    [
      `The Landlord is the owner of the property known as ${input.propertyLabel}, ${input.propertyAddress}.`,
      `The Tenant has expressed his/her desire to take a flat in the said property and the Landlord has agreed to let the said property to the Tenant at the yearly rent of ${input.annualRent ?? input.rentLabel}, such rent being payable monthly at ${input.monthlyRent ?? input.rentLabel}. The first payment is payable on the execution of this agreement. The tenancy shall run from ${input.startDate} to ${input.endDate}.`,
    ],
    ["i.", "ii."],
  );
  y -= 4;

  heading("NOW IT IS HEREBY AGREED THAT THE TENANT:");
  list(
    RESIDENTIAL_TENANCY.tenantObligations,
    ["i.", "ii.", "iii.", "iv.", "v.", "vi.", "vii.", "viii."],
  );
  y -= 4;

  heading("THE LANDLORD HEREBY UNDERTAKES TO BE RESPONSIBLE FOR:");
  for (const item of RESIDENTIAL_TENANCY.landlordUndertakings) {
    paragraph(item, { indent: 30 });
    y -= 5;
  }

  if (input.guarantors.length) {
    y -= 4;
    ensure(95);
    heading("GUARANTEE:");
    paragraph(
      `In consideration of the Landlord letting the property to the Tenant, ${input.guarantors
        .map((guarantor) => guarantor.name)
        .join(", ")} (the "Guarantor") guarantees the payment of rent and the performance by the Tenant of the obligations in this Agreement, subject to applicable law. The Guarantor confirms that they have read this Agreement and have had the opportunity to obtain independent legal advice.`,
    );
    y -= 4;
  }

  y -= 8;
  ensure(300);
  paragraph(RESIDENTIAL_TENANCY.witness);
  y -= 20;

  const placements: SignaturePlacement[] = [];

  const detailLine = (
    label: string,
    value: string | undefined,
    x: number,
    lineY: number,
    width: number,
  ) => {
    const text = sanitize(value ? `${label} ${value}` : label);
    page.drawText(text, { x, y: lineY, size: 9, font: regular, color: SLATE });
    const used = regular.widthOfTextAtSize(text, 9);
    if (used + 16 < width) {
      page.drawLine({
        start: { x: x + used + 6, y: lineY + 2 },
        end: { x: x + width, y: lineY + 2 },
        thickness: 0.6,
        color: HAIRLINE,
      });
    }
  };

  const signingLine = (
    label: string,
    recipientKey: string,
    type: "signature" | "date",
    x: number,
    lineY: number,
    width: number,
  ) => {
    page.drawText(label, { x, y: lineY, size: 9, font: regular, color: SLATE });
    const labelWidth = regular.widthOfTextAtSize(label, 9);
    const startX = x + labelWidth + 6;
    const endX = x + width;
    page.drawLine({
      start: { x: startX, y: lineY + 2 },
      end: { x: endX, y: lineY + 2 },
      thickness: 0.6,
      color: SLATE,
    });
    const fieldHeight = type === "signature" ? 24 : 18;
    placements.push({
      recipientKey,
      pageIndex: pages.length - 1,
      type,
      x: (startX + 2) / PAGE_WIDTH,
      y: (PAGE_HEIGHT - (lineY + fieldHeight + 4)) / PAGE_HEIGHT,
      width: Math.max(20, endX - startX - 4) / PAGE_WIDTH,
      height: fieldHeight / PAGE_HEIGHT,
    });
  };

  const signerBlock = (options: {
    key: string;
    headingLines: string[];
    name: string;
    extra?: { label: string; value?: string };
    witness: boolean;
    x: number;
    top: number;
    width: number;
  }): number => {
    let cursor = options.top;
    for (const line of options.headingLines) {
      page.drawText(line, {
        x: options.x,
        y: cursor,
        size: 8.5,
        font: bold,
        color: INK,
      });
      cursor -= 11;
    }
    cursor -= 22;
    signingLine("Signature:", options.key, "signature", options.x, cursor, options.width);
    cursor -= 34;
    if (options.extra) {
      detailLine(options.extra.label, options.extra.value, options.x, cursor, options.width);
      cursor -= 26;
    }
    detailLine("Name:", options.name, options.x, cursor, options.width);
    cursor -= 28;
    signingLine("Date:", options.key, "date", options.x, cursor, options.width);
    cursor -= 28;
    if (options.witness) {
      page.drawText("In the presence of", {
        x: options.x,
        y: cursor,
        size: 9,
        font: bold,
        color: INK,
      });
      cursor -= 20;
      for (const label of ["Name:", "Address:", "Occupation:"]) {
        detailLine(label, undefined, options.x, cursor, options.width);
        cursor -= 18;
      }
    }
    return options.top - cursor;
  };

  const colWidth = (CONTENT_WIDTH - 28) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colWidth + 28;

  ensure(250);
  const partiesTop = y;
  const landlordHeight = signerBlock({
    key: "landlord",
    headingLines: ["SIGNED and sealed by the said", "LANDLORD"],
    name: input.landlordName,
    extra: { label: "Represented by:" },
    witness: true,
    x: leftX,
    top: partiesTop,
    width: colWidth,
  });
  const tenantHeight = signerBlock({
    key: "tenant",
    headingLines: ["SIGNED by the said", "TENANT"],
    name: input.tenantName,
    witness: true,
    x: rightX,
    top: partiesTop,
    width: colWidth,
  });
  y = partiesTop - Math.max(landlordHeight, tenantHeight) - 16;

  const secondarySigners = [
    ...input.guarantors.map((guarantor, index) => ({
      key: `guarantor-${index}`,
      headingLines: [
        "SIGNED by the said",
        input.guarantors.length > 1 ? `GUARANTOR ${index + 1}` : "GUARANTOR",
      ],
      name: guarantor.name,
      extra: undefined,
    })),
    ...(input.lawyer
      ? [
          {
            key: "lawyer",
            headingLines: ["SIGNED as witness by the said", "LAWYER / WITNESS"],
            name: input.lawyer.name,
            extra: {
              label: "Law firm:",
              value: input.lawyer.firmName || input.workspaceName,
            },
          },
        ]
      : []),
  ];

  for (let index = 0; index < secondarySigners.length; index += 2) {
    ensure(180);
    const rowTop = y;
    let tallest = 0;
    for (const [offset, signer] of secondarySigners.slice(index, index + 2).entries()) {
      const height = signerBlock({
        ...signer,
        witness: false,
        x: offset === 0 ? leftX : rightX,
        top: rowTop,
        width: colWidth,
      });
      tallest = Math.max(tallest, height);
    }
    y = rowTop - tallest - 16;
  }

  const recipientKeys = [
    "tenant",
    ...input.guarantors.map((_, index) => `guarantor-${index}`),
    "landlord",
    ...(input.lawyer ? ["lawyer"] : []),
  ];

  for (let index = 0; index < pages.length; index += 1) {
    const current = pages[index];
    current.drawText(`Page ${index + 1} of ${pages.length}`, {
      x: PAGE_WIDTH - MARGIN - 52,
      y: 26,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
    current.drawText("Prepared with Juripass · Sign Flow", {
      x: MARGIN,
      y: 26,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
    current.drawText(sanitize(input.preparedBy), {
      x: MARGIN,
      y: 16,
      size: 7,
      font: regular,
      color: MUTED,
    });
  }

  const bytes = await doc.save();
  return { bytes, pageCount: doc.getPageCount(), placements, recipientKeys };
}

async function buildStandardAgreementPdf(
  input: AgreementPdfInput,
): Promise<AgreementPdfResult> {
  const doc = await PDFDocument.create();
  doc.setTitle(input.title);
  doc.setAuthor(input.workspaceName);
  doc.setCreator("Juripass Sign Flow");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = input.logo
    ? await (input.logo.mediaType === "image/png"
        ? doc.embedPng(input.logo.bytes)
        : doc.embedJpg(input.logo.bytes)
      ).catch(() => null)
    : null;

  const pages: PDFPage[] = [];
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - MARGIN;
  };

  const ensure = (height: number) => {
    if (y - height < MARGIN + 28) newPage();
  };

  const text = (
    value: string,
    options: { size?: number; font?: PDFFont; color?: typeof INK; x?: number; width?: number } = {},
  ) => {
    const size = options.size ?? 10.5;
    const font = options.font ?? regular;
    const x = options.x ?? MARGIN;
    const width = options.width ?? CONTENT_WIDTH;
    for (const line of wrap(value, font, size, width)) {
      ensure(size + 5);
      page.drawText(line, { x, y, size, font, color: options.color ?? SLATE });
      y -= size * 1.55;
    }
  };

  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 6, width: PAGE_WIDTH, height: 6, color: NAVY });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: 72, height: 2, color: AMBER });
  if (logo) {
    const scale = Math.min(130 / logo.width, 28 / logo.height, 1);
    page.drawImage(logo, {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN - logo.height * scale + 8,
      width: logo.width * scale,
      height: logo.height * scale,
    });
  } else {
    page.drawText("JURIPASS", { x: MARGIN, y: y - 10, size: 12, font: bold, color: INK });
    page.drawText("SIGN FLOW", { x: MARGIN + 66, y: y - 10, size: 8.5, font: bold, color: NAVY });
  }
  const workspaceWidth = bold.widthOfTextAtSize(sanitize(input.workspaceName), 9);
  page.drawText(sanitize(input.workspaceName), {
    x: PAGE_WIDTH - MARGIN - workspaceWidth,
    y: y - 10,
    size: 9,
    font: bold,
    color: MUTED,
  });
  y -= 44;

  text(input.title, { size: 22, font: bold, color: INK });
  y -= 4;
  text(`${input.precedent.category} · Prepared ${input.startDate}`, { size: 9.5, color: MUTED });
  y -= 12;

  page.drawRectangle({
    x: MARGIN,
    y: y - 4,
    width: CONTENT_WIDTH,
    height: 1,
    color: HAIRLINE,
  });
  y -= 22;

  const terms: Array<[string, string]> = [
    ["Landlord", `${input.landlordName} · ${input.landlordEmail}`],
    ["Tenant", `${input.tenantName} · ${input.tenantEmail}`],
    ["Guarantor", input.guarantors.length ? input.guarantors.map((g) => `${g.name} (${g.relationship || "guarantor"})`).join("; ") : "None named"],
    ["Property", `${input.propertyLabel} · ${input.propertyAddress}`],
    ["Rent", input.rentLabel],
    ["Term", `${input.startDate} to ${input.endDate}`],
    ["Jurisdiction", input.jurisdiction],
    ...(input.lawyer
      ? ([
          [
            "Law firm",
            `${input.lawyer.firmName || input.workspaceName} · ${input.lawyer.name} · ${input.lawyer.email}`,
          ],
        ] as Array<[string, string]>)
      : []),
  ];
  for (const [label, value] of terms) {
    ensure(34);
    page.drawText(label, { x: MARGIN, y, size: 8, font: bold, color: MUTED });
    const lines = wrap(value, regular, 9.5, CONTENT_WIDTH - 90);
    page.drawText(lines[0] ?? "", { x: MARGIN + 90, y, size: 9.5, font: regular, color: INK });
    y -= 13;
    for (const line of lines.slice(1)) {
      page.drawText(line, { x: MARGIN + 90, y, size: 9.5, font: regular, color: INK });
      y -= 12;
    }
    y -= 5;
  }

  y -= 8;
  text(
    "This agreement is prepared from a Juripass precedent. It is a working draft for review and does not by itself constitute legal advice or guarantee enforceability in any jurisdiction.",
    { size: 8.5, color: MUTED },
  );
  y -= 6;

  for (const clause of input.precedent.clauses) {
    ensure(48);
    text(clause.heading, { size: 10.5, font: bold, color: INK });
    y -= 2;
    text(clause.body, { size: 9.5, color: SLATE });
    y -= 8;
  }

  if (input.guarantors.length) {
    ensure(70);
    text("Guarantor acknowledgement", { size: 10.5, font: bold, color: INK });
    y -= 2;
    text(
      "Each guarantor confirms that they have read this agreement, understand the guarantee described in the key terms and have had the opportunity to obtain independent legal advice before signing.",
      { size: 9.5, color: SLATE },
    );
    y -= 8;
  }

  const recipientKeys = [
    "tenant",
    ...input.guarantors.map((_, index) => `guarantor-${index}`),
    "landlord",
    ...(input.lawyer ? ["lawyer"] : []),
  ];
  const signers = [
    { key: "tenant", role: "Tenant", name: input.tenantName },
    ...input.guarantors.map((guarantor, index) => ({
      key: `guarantor-${index}`,
      role: `Guarantor${input.guarantors.length > 1 ? ` ${index + 1}` : ""}`,
      name: guarantor.name,
    })),
    { key: "landlord", role: "Landlord", name: input.landlordName },
    ...(input.lawyer ? [{ key: "lawyer", role: "Lawyer / witness", name: input.lawyer.name }] : []),
  ];

  const placements: SignaturePlacement[] = [];
  let signerIndex = 0;
  while (signerIndex < signers.length) {
    newPage();
    const pageIndex = pages.length - 1;
    page.drawText("Execution", { x: MARGIN, y, size: 18, font: bold, color: INK });
    y -= 8;
    for (const line of wrap(
      "Sign and date below. Each signature is recorded through Sign Flow with a time-stamped audit entry.",
      regular,
      9,
      CONTENT_WIDTH,
    )) {
      page.drawText(line, { x: MARGIN, y, size: 9, font: regular, color: MUTED });
      y -= 13;
    }
    y -= 21;

    const perPage = 6;
    const slice = signers.slice(signerIndex, signerIndex + perPage);
    for (const signer of slice) {
      const blockTop = y + 12;
      page.drawText(signer.role.toUpperCase(), {
        x: MARGIN,
        y: blockTop,
        size: 7.5,
        font: bold,
        color: NAVY,
      });
      page.drawText(sanitize(signer.name), {
        x: MARGIN,
        y: blockTop - 16,
        size: 11,
        font: bold,
        color: INK,
      });
      const lineY = blockTop - 44;
      page.drawLine({
        start: { x: MARGIN, y: lineY },
        end: { x: MARGIN + 236, y: lineY },
        thickness: 0.7,
        color: SLATE,
      });
      page.drawText("Signature", { x: MARGIN, y: lineY - 11, size: 7.5, font: regular, color: MUTED });
      page.drawLine({
        start: { x: MARGIN + 266, y: lineY },
        end: { x: MARGIN + 420, y: lineY },
        thickness: 0.7,
        color: SLATE,
      });
      page.drawText("Date", { x: MARGIN + 266, y: lineY - 11, size: 7.5, font: regular, color: MUTED });

      placements.push({
        recipientKey: signer.key,
        pageIndex,
        type: "signature",
        x: MARGIN / PAGE_WIDTH,
        y: (PAGE_HEIGHT - (lineY + 32)) / PAGE_HEIGHT,
        width: 226 / PAGE_WIDTH,
        height: 28 / PAGE_HEIGHT,
      });
      placements.push({
        recipientKey: signer.key,
        pageIndex,
        type: "date",
        x: (MARGIN + 266) / PAGE_WIDTH,
        y: (PAGE_HEIGHT - (lineY + 26)) / PAGE_HEIGHT,
        width: 145 / PAGE_WIDTH,
        height: 22 / PAGE_HEIGHT,
      });
      y -= 108;
      signerIndex += 1;
    }
  }

  for (let index = 0; index < pages.length; index += 1) {
    const current = pages[index];
    current.drawText(`Page ${index + 1} of ${pages.length}`, {
      x: PAGE_WIDTH - MARGIN - 52,
      y: 26,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
    current.drawText("Prepared with Juripass · Sign Flow", {
      x: MARGIN,
      y: 26,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
    current.drawText(sanitize(input.preparedBy), {
      x: MARGIN,
      y: 16,
      size: 7,
      font: regular,
      color: MUTED,
    });
  }

  const bytes = await doc.save();
  return { bytes, pageCount: doc.getPageCount(), placements, recipientKeys };
}
