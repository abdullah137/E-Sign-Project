import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface CertificateRecipient {
  name: string;
  email: string;
  status: string;
  openedAt: string | null;
  consentAt: string | null;
  signedAt: string | null;
}

export interface CertificateEvent {
  at: string;
  eventType: string;
  actorKind: string;
  actorLabel: string | null;
  metadata: Record<string, unknown>;
}

export interface CertificateData {
  documentTitle: string;
  documentId: string;
  workspaceName: string;
  senderName: string;
  originalSha256: string;
  completedSha256: string;
  sentAt: string | null;
  completedAt: string | null;
  auditValid: boolean;
  auditCount: number;
  recipients: CertificateRecipient[];
  events: CertificateEvent[];
}

const INK = rgb(0.071, 0.078, 0.09);
const SLATE = rgb(0.369, 0.396, 0.451);
const GOLD = rgb(0.722, 0.584, 0.345);
const HAIRLINE = rgb(0.9, 0.905, 0.91);

function formatUtc(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) {
      line = word;
    } else if (`${line} ${word}`.length <= maxChars) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function buildAuditCertificate(data: CertificateData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const body = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  let page = doc.addPage([595.28, 841.89]);
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 54;
  let y = height - margin;

  const newPage = () => {
    page = doc.addPage([595.28, 841.89]);
    y = height - margin;
  };
  const ensure = (needed: number) => {
    if (y - needed < margin + 30) newPage();
  };
  const text = (
    value: string,
    options: { size?: number; font?: typeof body; color?: typeof INK; x?: number; gap?: number } = {},
  ) => {
    const size = options.size ?? 9;
    const font = options.font ?? body;
    const x = options.x ?? margin;
    ensure(size + 6);
    page.drawText(value, { x, y, size, font, color: options.color ?? INK });
    y -= size + (options.gap ?? 4);
  };

  page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: GOLD });
  page.drawText("SIGNFLOW", { x: margin, y: y - 4, size: 9, font: bold, color: GOLD });
  y -= 26;
  text("Certificate of Completion", { size: 24, font: serifBold, gap: 8 });
  const titleLines = wrap(data.documentTitle, 62);
  for (const line of titleLines) {
    text(line, { size: 15, font: serif, gap: 3 });
  }
  y -= 8;
  text(
    `Document reference  ${data.documentId}`,
    { size: 7.5, font: mono, color: SLATE, gap: 8 },
  );
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.75,
    color: HAIRLINE,
  });
  y -= 20;

  text("RECORD SUMMARY", { size: 8, font: bold, color: SLATE, gap: 8 });
  const summary: Array<[string, string]> = [
    ["Workspace", data.workspaceName],
    ["Sent by", data.senderName],
    ["Sent at", formatUtc(data.sentAt)],
    ["Completed at", formatUtc(data.completedAt)],
    ["Audit events", String(data.auditCount)],
    ["Audit chain", data.auditValid ? "Verified — hashes intact" : "Integrity warning"],
  ];
  for (const [label, value] of summary) {
    ensure(13);
    page.drawText(label, { x: margin, y, size: 8.5, font: bold, color: SLATE });
    page.drawText(value, { x: margin + 108, y, size: 8.5, font: body, color: INK });
    y -= 13;
  }
  y -= 10;

  text("DOCUMENT INTEGRITY", { size: 8, font: bold, color: SLATE, gap: 8 });
  ensure(34);
  page.drawText("Original PDF SHA-256", { x: margin, y, size: 7.5, font: bold, color: SLATE });
  y -= 11;
  for (const chunk of data.originalSha256.match(/.{1,64}/g) ?? []) {
    text(chunk, { size: 7, font: mono, color: INK, gap: 2 });
  }
  y -= 4;
  page.drawText("Completed PDF SHA-256", { x: margin, y, size: 7.5, font: bold, color: SLATE });
  y -= 11;
  for (const chunk of data.completedSha256.match(/.{1,64}/g) ?? []) {
    text(chunk, { size: 7, font: mono, color: INK, gap: 2 });
  }
  y -= 14;

  text("SIGNERS", { size: 8, font: bold, color: SLATE, gap: 8 });
  for (const recipient of data.recipients) {
    ensure(58);
    page.drawRectangle({
      x: margin,
      y: y - 46,
      width: width - margin * 2,
      height: 50,
      borderColor: HAIRLINE,
      borderWidth: 0.75,
    });
    page.drawText(recipient.name || "Unnamed recipient", {
      x: margin + 10,
      y: y - 12,
      size: 9.5,
      font: bold,
      color: INK,
    });
    page.drawText(recipient.email, {
      x: margin + 10,
      y: y - 24,
      size: 8,
      font: body,
      color: SLATE,
    });
    page.drawText(
      `Status: ${recipient.status}   ·   Consent: ${formatUtc(recipient.consentAt)}   ·   Signed: ${formatUtc(recipient.signedAt)}`,
      { x: margin + 10, y: y - 37, size: 7.5, font: body, color: SLATE },
    );
    y -= 58;
  }
  y -= 6;

  text("ACTIVITY RECORD", { size: 8, font: bold, color: SLATE, gap: 8 });
  for (const event of data.events) {
    ensure(30);
    page.drawText(formatUtc(event.at), { x: margin, y, size: 7, font: mono, color: SLATE });
    page.drawText(event.eventType, { x: margin + 132, y, size: 8, font: bold, color: INK });
    page.drawText(`${event.actorKind}${event.actorLabel ? ` · ${event.actorLabel}` : ""}`, {
      x: margin + 280,
      y,
      size: 7.5,
      font: body,
      color: SLATE,
    });
    y -= 11;
    const meta = JSON.stringify(event.metadata);
    if (meta && meta !== "{}") {
      const metaLines = wrap(meta, 110).slice(0, 2);
      for (const line of metaLines) {
        ensure(10);
        page.drawText(line, { x: margin + 132, y, size: 6.5, font: mono, color: SLATE });
        y -= 8;
      }
    }
    y -= 4;
  }

  ensure(80);
  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.75,
    color: HAIRLINE,
  });
  y -= 16;
  const disclaimer =
    "This certificate records the signing activity and document hashes held by SignFlow at the time of completion. " +
    "It is an evidentiary record, not a legal opinion. The legal effect of an electronic signature depends on the " +
    "applicable jurisdiction, identity assurance, consent, and the circumstances of the transaction. Consult qualified " +
    "counsel for your jurisdiction.";
  for (const line of wrap(disclaimer, 118)) {
    page.drawText(line, { x: margin, y, size: 7, font: body, color: SLATE });
    y -= 9;
  }

  return doc.save();
}
