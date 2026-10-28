import { PDFDocument } from "pdf-lib";
import { env } from "../env";

export interface PdfInspection {
  pageCount: number;
  encrypted: boolean;
}

export class PdfValidationError extends Error {}

export async function inspectPdf(bytes: Uint8Array, declaredSize: number): Promise<PdfInspection> {
  const limit = env.maxUploadMb * 1024 * 1024;
  if (declaredSize > limit) {
    throw new PdfValidationError(
      `This file is ${(declaredSize / 1024 / 1024).toFixed(1)} MB. The limit is ${env.maxUploadMb} MB.`,
    );
  }
  if (bytes.length < 5) throw new PdfValidationError("The file is empty or not a PDF.");
  const header = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  if (!header.includes("%PDF-")) {
    throw new PdfValidationError("This file is not a valid PDF. Please choose a PDF document.");
  }
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/encrypt|password/i.test(message)) {
      throw new PdfValidationError(
        "This PDF is password-protected or encrypted. Please remove the protection and upload it again.",
      );
    }
    throw new PdfValidationError("This PDF appears to be damaged and cannot be read.");
  }
  const pageCount = doc.getPageCount();
  if (pageCount < 1) throw new PdfValidationError("This PDF does not contain any pages.");
  if (pageCount > env.maxPdfPages) {
    throw new PdfValidationError(
      `This PDF has ${pageCount} pages. The limit is ${env.maxPdfPages} pages per document.`,
    );
  }
  return { pageCount, encrypted: false };
}
