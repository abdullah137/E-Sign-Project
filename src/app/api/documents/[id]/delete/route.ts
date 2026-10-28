import { apiError, apiOk, assertSameOrigin, handleRouteError } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { deleteDraftDocument, ensureDocumentAccess, getDocument } from "@/lib/documents";

export const runtime = "nodejs";

export async function DELETE(
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
    ensureDocumentAccess(ctx.membership.role, doc, ctx.user.id, "delete");
    deleteDraftDocument(db, {
      documentId: doc.id,
      workspaceId: ctx.workspace.id,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
    });
    return apiOk({ ok: true, redirect: "/app/documents" });
  } catch (error) {
    return handleRouteError(error);
  }
}
