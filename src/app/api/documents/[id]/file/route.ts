import { NextResponse } from "next/server";
import { apiError, handleRouteError } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { ensureDocumentAccess, getDocument, getDocumentFiles } from "@/lib/documents";
import { readStoredObject } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ctx = await requireApiContext();
    const db = getDb();
    const doc = getDocument(db, id, ctx.workspace.id);
    if (!doc) return apiError("Document not found.", 404, "not_found");
    ensureDocumentAccess(ctx.membership.role, doc, ctx.user.id, "view");
    const files = getDocumentFiles(db, doc.id);
    if (!files.original) return apiError("The original PDF is not available.", 404, "not_found");
    const bytes = readStoredObject(files.original.storage_key);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `inline; filename="${encodeURIComponent(files.original.original_filename)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
