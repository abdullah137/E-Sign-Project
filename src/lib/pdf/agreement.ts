import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Precedent } from "../precedents";

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
