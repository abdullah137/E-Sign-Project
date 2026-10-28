import { apiError, apiOk, assertSameOrigin, clientIp, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { ensureDocumentAccess, getDocument, remindRecipient } from "@/lib/documents";
import { remindSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
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
    ensureDocumentAccess(ctx.membership.role, doc, ctx.user.id, "edit");
    const parsed = await parseJsonBody(request, remindSchema);
    if ("response" in parsed) return parsed.response;
    const limit = rateLimit(db, `remind:${parsed.data.recipientId}`, 1, 5 * 60 * 1000);
    if (!limit.allowed) {
      return apiError(
        `A reminder was just sent. You can send another in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
        429,
        "rate_limited",
      );
    }
    const result = await remindRecipient(db, {
      documentId: doc.id,
      workspaceId: ctx.workspace.id,
      recipientId: parsed.data.recipientId,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return apiOk({
      ok: true,
      expiresAt: result.expiresAt,
      demoLink: env.showDevOutbox ? result.link : undefined,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
