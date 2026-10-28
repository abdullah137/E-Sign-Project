import { NextResponse } from "next/server";
import { assertSameOrigin, apiError, apiOk, clientIp, handleRouteError } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { inspectPdf, PdfValidationError } from "@/lib/pdf/validate";
import { createDraftDocument } from "@/lib/documents";
import { rateLimit } from "@/lib/rate-limit";
import { ValidationError } from "@/lib/errors";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    const db = getDb();
    const limit = rateLimit(db, `upload:${ctx.workspace.id}`, 120, 60 * 60 * 1000);
    if (!limit.allowed) {
      return apiError("Too many uploads in a short period. Try again later.", 429, "rate_limited");
    }

    const form = await request.formData();
    const file = form.get("file");
    const titleValue = form.get("title");
    if (!(file instanceof File)) {
      return apiError("Choose a PDF file to upload.", 422, "validation_error");
    }
    if (file.size === 0) throw new ValidationError("The selected file is empty.");
    if (file.size > env.maxUploadMb * 1024 * 1024) {
      throw new PdfValidationError(
        `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${env.maxUploadMb} MB.`,
      );
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    let inspected;
    try {
      inspected = await inspectPdf(bytes, file.size);
    } catch (error) {
      if (error instanceof PdfValidationError) {
        return apiError(error.message, 422, "invalid_pdf");
      }
      throw error;
    }
    const fallbackTitle = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
    const title =
      (typeof titleValue === "string" && titleValue.trim()) ||
      fallbackTitle ||
      "Untitled document";
    if (title.length > 160) throw new ValidationError("The title must be 160 characters or fewer.");

    const document = await createDraftDocument(db, {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      userLabel: ctx.user.full_name || ctx.user.email,
      title,
      fileName: file.name || "document.pdf",
      bytes,
      pageCount: inspected.pageCount,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return apiOk(
      {
        id: document.id,
        title: document.title,
        pageCount: inspected.pageCount,
        redirect: `/app/documents/${document.id}/prepare`,
      },
      201,
    );
  } catch (error) {
    if (error instanceof PdfValidationError) {
      return apiError(error.message, 422, "invalid_pdf");
    }
    return handleRouteError(error);
  }
}
