import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import {
  displayPointToUser,
  displaySize,
  localAxes,
  normalizeRotation,
  type Rotation,
} from "./coords";

export interface FinalizeSignature {
  bytes: Uint8Array;
  mediaType: string;
}

export interface FieldForFinalization {
  pageIndex: number;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  valueText?: string | null;
  checked?: boolean | null;
  signature?: FinalizeSignature | null;
  fontSizeHint?: number | null;
}

const INK = rgb(0.071, 0.078, 0.09);

function sanitize(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\xFF]/g, "?");
}

function shrinkToFit(text: string, font: PDFFont, size: number, maxWidth: number): number {
  let current = size;
  while (current > 5 && font.widthOfTextAtSize(text, current) > maxWidth) {
    current -= 0.5;
  }
  return current;
}

interface Placement {
  anchor: { x: number; y: number };
  displayWidth: number;
  displayHeight: number;
  rotation: Rotation;
  pageWidth: number;
  pageHeight: number;
}

function placementFor(
  page: PDFPage,
  field: FieldForFinalization,
  rotation: Rotation,
): Placement {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const { width: displayWidth, height: displayHeight } = displaySize(
    pageWidth,
    pageHeight,
    rotation,
  );
  const anchor = displayPointToUser(
    field.x,
    field.y + field.height,
    pageWidth,
    pageHeight,
    rotation,
  );
  return { anchor, displayWidth, displayHeight, rotation, pageWidth, pageHeight };
}

function localPoint(
  placement: Placement,
  offsetX: number,
  offsetY: number,
): { x: number; y: number } {
  const axes = localAxes(placement.rotation);
  return {
    x: placement.anchor.x + axes.x.x * offsetX + axes.y.x * offsetY,
    y: placement.anchor.y + axes.x.y * offsetX + axes.y.y * offsetY,
  };
}

export async function finalizePdf(
  originalBytes: Uint8Array,
  fields: FieldForFinalization[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(originalBytes, { updateMetadata: false });
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const dingbats = await doc.embedFont(StandardFonts.ZapfDingbats);
  const pages = doc.getPages();

  for (const field of fields) {
    const page = pages[field.pageIndex];
    if (!page) continue;
    const rotation = normalizeRotation(page.getRotation().angle);
    const placement = placementFor(page, field, rotation);
    const padding = Math.max(2, Math.min(6, field.height * placement.displayHeight * 0.08));
    const boxWidth = field.width * placement.displayWidth - padding * 2;
    const boxHeight = field.height * placement.displayHeight - padding * 2;
    if (boxWidth <= 0 || boxHeight <= 0) continue;

    if (field.type === "checkbox") {
      if (!field.checked) continue;
      const size = Math.min(boxHeight, boxWidth, 18);
      const glyph = "4";
      const glyphWidth = dingbats.widthOfTextAtSize(glyph, size);
      const point = localPoint(
        placement,
        (field.width * placement.displayWidth - glyphWidth) / 2,
        (field.height * placement.displayHeight - size) / 2 + size * 0.12,
      );
      page.drawText(glyph, {
        x: point.x,
        y: point.y,
        size,
        font: dingbats,
        color: INK,
        rotate: degrees(rotation),
      });
      continue;
    }

    if (field.type === "signature" || field.type === "initials") {
      if (field.signature) {
        let image: PDFImage | null = null;
        try {
          image =
            field.signature.mediaType === "image/png"
              ? await doc.embedPng(field.signature.bytes)
              : await doc.embedJpg(field.signature.bytes);
        } catch {
          image = null;
        }
        if (image) {
          const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
          const drawWidth = image.width * scale;
          const drawHeight = image.height * scale;
          const offsetX = (field.width * placement.displayWidth - drawWidth) / 2;
          const offsetY = (field.height * placement.displayHeight - drawHeight) / 2;
          const point = localPoint(placement, offsetX, offsetY);
          page.drawImage(image, {
            x: point.x,
            y: point.y,
            width: drawWidth,
            height: drawHeight,
            rotate: degrees(rotation),
          });
          continue;
        }
      }
      if (field.valueText) {
        const size = shrinkToFit(
          sanitize(field.valueText),
          helvetica,
          Math.min(boxHeight, field.height * placement.displayHeight * 0.55),
          boxWidth,
        );
        const point = localPoint(placement, padding, padding + size * 0.2);
        page.drawText(sanitize(field.valueText), {
          x: point.x,
          y: point.y,
          size,
          font: helvetica,
          color: INK,
          rotate: degrees(rotation),
        });
      }
      continue;
    }

    const text = (field.valueText ?? "").trim();
    if (!text) continue;
    const rawSize = Math.min(
      field.fontSizeHint ?? field.height * placement.displayHeight * 0.5,
      28,
    );
    const size = shrinkToFit(sanitize(text), helvetica, Math.max(5, rawSize), boxWidth);
    const point = localPoint(placement, padding, padding + size * 0.2);
    page.drawText(sanitize(text), {
      x: point.x,
      y: point.y,
      size,
      font: helvetica,
      color: INK,
      rotate: degrees(rotation),
    });
  }

  doc.setProducer("SignFlow");
  doc.setModificationDate(new Date());
  return doc.save();
}
