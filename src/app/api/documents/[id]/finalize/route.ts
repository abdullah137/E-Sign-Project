import { apiError, apiOk, assertSameOrigin, handleRouteError } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { ensureDocumentAccess, finalizeDocument, getDocument } from "@/lib/documents";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    const db = getDb();
    const doc = getDocument(db, id, ctx.workspace.id);
    if (!doc) return apiError("Document not found.", 404, "not_found");
    ensureDocumentAccess(ctx.membership.role, doc, ctx.user.id, "edit");
    await finalizeDocument(db, doc.id);
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
