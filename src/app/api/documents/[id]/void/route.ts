import { apiError, apiOk, assertSameOrigin, clientIp, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { ensureDocumentAccess, getDocument, voidDocument } from "@/lib/documents";
import { voidSchema } from "@/lib/validation";

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
    ensureDocumentAccess(ctx.membership.role, doc, ctx.user.id, "delete");
    const parsed = await parseJsonBody(request, voidSchema);
    if ("response" in parsed) return parsed.response;
    await voidDocument(db, {
      documentId: doc.id,
      workspaceId: ctx.workspace.id,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
      reason: parsed.data.reason,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
