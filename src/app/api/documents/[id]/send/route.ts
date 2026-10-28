import { apiError, apiOk, assertSameOrigin, clientIp, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { ensureDocumentAccess, getDocument, sendDocument } from "@/lib/documents";
import { sendSchema } from "@/lib/validation";
import { env } from "@/lib/env";

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
    ensureDocumentAccess(ctx.membership.role, doc, ctx.user.id, "send");
    const parsed = await parseJsonBody(request, sendSchema);
    if ("response" in parsed) return parsed.response;
    const result = await sendDocument(db, {
      documentId: doc.id,
      workspaceId: ctx.workspace.id,
      actor: {
        id: ctx.user.id,
        label: ctx.user.full_name || ctx.user.email,
        email: ctx.user.email,
      },
      message: parsed.data.message,
      expiresInDays: parsed.data.expiresInDays,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return apiOk({
      ok: true,
      expiresAt: result.expiresAt,
      recipientCount: result.links.length,
      demoLinks: env.showDevOutbox ? result.links.map(({ email, link }) => ({ email, link })) : [],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
