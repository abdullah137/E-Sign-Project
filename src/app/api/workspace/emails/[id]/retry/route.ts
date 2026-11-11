import { apiError, apiOk, assertSameOrigin, handleRouteError } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { retryEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    if (!isAdmin(ctx.membership.role)) {
      return apiError("Only workspace owners and admins can retry delivery.", 403, "forbidden");
    }
    const { id } = await params;
    const db = getDb();
    const row = db
      .prepare("SELECT id FROM email_outbox WHERE id = ? AND json_extract(payload_json, '$.workspaceId') = ?")
      .get(id, ctx.workspace.id) as { id: string } | undefined;
    if (!row) return apiError("That message was not found.", 404, "not_found");
    const retried = await retryEmail(db, id);
    if (!retried) {
      return apiError("Only failed or development-outbox messages can be retried.", 409, "conflict");
    }
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
