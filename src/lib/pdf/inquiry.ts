import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

const WIDTH = 595.28;
const HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT = WIDTH - MARGIN * 2;
const INK = rgb(0.051, 0.161, 0.302);
const SLATE = rgb(0.278, 0.333, 0.412);
const MUTED = rgb(0.392, 0.455, 0.545);
const BLUE = rgb(0.051, 0.161, 0.302);
const AMBER = rgb(0.98, 0.714, 0.255);
const LINE = rgb(0.875, 0.894, 0.922);

export interface InquirySummaryInput {
  workspaceName: string;
  propertyName: string;
  propertyReference: string;
  propertyAddress: string;
  unitLabel?: string | null;
  landlordName: string;
  landlordEmail: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  currentAddress?: string | null;
  currentCity?: string | null;
  currentState?: string | null;
  reasonForMoving?: string | null;
  maritalStatus?: string | null;
  childrenCount?: number | null;
  employmentStatus?: string | null;
  employer?: string | null;
  occupation?: string | null;
  employmentAddress?: string | null;
  incomeRange?: string | null;
  religionState?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  occupantsCount?: number | null;
  dependentsCount?: number | null;
  bedroomsRequired?: number | null;
  stateOfOrigin?: string | null;
  additionalInfo?: string | null;
  declarationAccepted?: boolean;
  signatureName?: string | null;
  notes?: string | null;
  landlordPhone?: string | null;
  propertyType?: string | null;
  monthlyRent?: string | null;
  passportPhoto?: { bytes: Uint8Array; mediaType: string } | null;
  passportFileName?: string | null;
  guarantors: Array<{ name: string; email: string; relationship: string }>;
  status: string;
  submittedAt?: string | null;
  generatedAt: string;
  logo?: { bytes: Uint8Array; mediaType: string } | null;
}

function clean(value: string | null | undefined): string {
  return (value || "")
    .replace(/\u20A6/g, "NGN ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\xFF]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of clean(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

export async function buildInquirySummaryPdf(input: InquirySummaryInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Tenant inquiry - ${input.applicantName}`);
  doc.setAuthor(input.workspaceName);
  doc.setCreator("Juripass");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = input.logo
    ? await (input.logo.mediaType === "image/png"
        ? doc.embedPng(input.logo.bytes)
        : doc.embedJpg(input.logo.bytes)
      ).catch(() => null)
    : null;
  const passport = input.passportPhoto
    ? await (input.passportPhoto.mediaType === "image/png"
        ? doc.embedPng(input.passportPhoto.bytes)
        : doc.embedJpg(input.passportPhoto.bytes)
      ).catch(() => null)
    : null;
  const pages = [doc.addPage([WIDTH, HEIGHT])];
  let page = pages[0];
  let y = HEIGHT - MARGIN;

  const nextPage = () => {
    page = doc.addPage([WIDTH, HEIGHT]);
    pages.push(page);
    y = HEIGHT - MARGIN;
  };
  const ensure = (height: number) => {
    if (y - height < MARGIN + 24) nextPage();
  };
  const paragraph = (value: string, size = 9.5, color = SLATE, width = CONTENT) => {
    for (const line of wrap(value, regular, size, width)) {
      ensure(size + 5);
      page.drawText(line, { x: MARGIN, y, size, font: regular, color });
      y -= size * 1.55;
    }
  };

  page.drawRectangle({ x: 0, y: HEIGHT - 6, width: WIDTH, height: 6, color: BLUE });
  page.drawRectangle({ x: 0, y: HEIGHT - 6, width: 96, height: 6, color: AMBER });
  if (logo) {
    const scale = Math.min(130 / logo.width, 28 / logo.height, 1);
    page.drawImage(logo, {
      x: MARGIN,
      y: HEIGHT - MARGIN - logo.height * scale + 8,
      width: logo.width * scale,
      height: logo.height * scale,
    });
  } else {
    page.drawText("JURIPASS", { x: MARGIN, y: y - 10, size: 12, font: bold, color: INK });
  }
  const photoWidth = 72;
  const photoHeight = 92;
  const photoX = WIDTH - MARGIN - photoWidth;
  const photoY = HEIGHT - MARGIN - photoHeight;
  if (passport) {
    page.drawRectangle({
      x: photoX - 1,
      y: photoY - 1,
      width: photoWidth + 2,
      height: photoHeight + 2,
      color: rgb(1, 1, 1),
      borderColor: LINE,
      borderWidth: 1,
    });
    const scale = Math.min(photoWidth / passport.width, photoHeight / passport.height);
    const drawWidth = passport.width * scale;
    const drawHeight = passport.height * scale;
    page.drawImage(passport, {
      x: photoX + (photoWidth - drawWidth) / 2,
      y: photoY + (photoHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
  }
  const headerRight = passport ? photoX - 12 : WIDTH - MARGIN;
  const brandWidth = bold.widthOfTextAtSize(clean(input.workspaceName), 9);
  page.drawText(clean(input.workspaceName), { x: headerRight - brandWidth, y: y - 10, size: 9, font: bold, color: MUTED });
  y -= 46;

  page.drawText("Tenant inquiry summary", { x: MARGIN, y, size: 22, font: bold, color: INK });
  y -= 22;
  paragraph(`${input.propertyName} · ${input.propertyReference}`, 10.5, MUTED, headerRight - MARGIN);
  y -= 6;
  page.drawRectangle({ x: MARGIN, y, width: headerRight - MARGIN, height: 1, color: LINE });
  y -= 24;

  const row = (label: string, value: string) => {
    ensure(30);
    page.drawText(label, { x: MARGIN, y, size: 8, font: bold, color: MUTED });
    const lines = wrap(value || "—", regular, 9.5, CONTENT - 118);
    page.drawText(lines[0], { x: MARGIN + 118, y, size: 9.5, font: regular, color: INK });
    y -= 13;
    for (const line of lines.slice(1)) {
      page.drawText(line, { x: MARGIN + 118, y, size: 9.5, font: regular, color: INK });
      y -= 12;
    }
    y -= 5;
  };
  const section = (title: string) => {
    ensure(58);
    page.drawText(title, { x: MARGIN, y, size: 11, font: bold, color: INK });
    y -= 18;
  };

  section("Applicant");
  row("Full name", input.applicantName);
  row("Email", input.applicantEmail);
  row("Phone", input.applicantPhone);
  row("Current address", input.currentAddress || "Not provided");
  row("City", input.currentCity || "Not provided");
  row("State or region", input.currentState || "Not provided");
  row("State of origin", input.stateOfOrigin || "Not provided");
  row("Marital status", input.maritalStatus || "Not provided");
  if (input.maritalStatus !== "Single") {
    row("Children", input.childrenCount === null || input.childrenCount === undefined ? "Not provided" : String(input.childrenCount));
  }
  row("Dependents", input.dependentsCount === null || input.dependentsCount === undefined ? "Not provided" : String(input.dependentsCount));
  row("Occupants", input.occupantsCount === null || input.occupantsCount === undefined ? "Not provided" : String(input.occupantsCount));
  row("Bedrooms required", input.bedroomsRequired === null || input.bedroomsRequired === undefined ? "Not provided" : String(input.bedroomsRequired));
  row("Employment", [input.employmentStatus, input.occupation, input.employer].filter(Boolean).join(" · ") || "Not provided");
  row("Employment address", input.employmentAddress || "Not provided");
  row("Income range", input.incomeRange || "Not provided");
  row("Reason for moving", input.reasonForMoving || "Not provided");
  row("Additional information", input.additionalInfo || input.notes || "None");
  row("Typed signature", input.signatureName || "Not signed");
  row("Declaration", input.declarationAccepted === false ? "Not accepted" : "Accepted");
  row(
    "Passport photo",
    input.passportPhoto
      ? `Attached${input.passportFileName ? ` · ${input.passportFileName}` : ""}`
      : "Not provided",
  );

  y -= 12;
  section("Property and landlord");
  row("Property", `${input.propertyName} · ${input.propertyAddress}`);
  row("Unit", input.unitLabel || "Whole property");
  row("Property type", input.propertyType || "Not provided");
  row("Monthly rent", input.monthlyRent || "Not provided");
  row("Landlord", `${input.landlordName} · ${input.landlordEmail}`);
  row("Landlord phone", input.landlordPhone || "Not provided");

  y -= 12;
  section("Guarantors");
  if (input.guarantors.length === 0) {
    paragraph("No guarantor was named in this inquiry.");
  } else {
    for (const guarantor of input.guarantors) {
      row(guarantor.relationship, `${guarantor.name} · ${guarantor.email}`);
    }
  }

  y -= 12;
  section("Status");
  row("Application", input.status.replaceAll("_", " "));
  row("Submitted", input.submittedAt || "Not submitted");
  row("Generated", input.generatedAt);

  y -= 16;
  page.drawRectangle({ x: MARGIN, y, width: CONTENT, height: 1, color: LINE });
  y -= 18;
  paragraph(
    "This summary reflects the information supplied by the applicant. Juripass has not independently verified identity, income, employment or guarantor details. Landlords should make their own enquiries before approving a tenancy.",
    8.5,
    MUTED,
  );

  for (let index = 0; index < pages.length; index += 1) {
    pages[index].drawText(`Page ${index + 1} of ${pages.length}`, {
      x: WIDTH - MARGIN - 52,
      y: 26,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
    pages[index].drawText("Prepared with Juripass", {
      x: MARGIN,
      y: 26,
      size: 7.5,
      font: regular,
      color: MUTED,
    });
  }

  return doc.save();
}
