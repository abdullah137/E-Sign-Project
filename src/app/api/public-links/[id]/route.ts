import { apiError, apiOk, assertSameOrigin, handleRouteError } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { revokePublicLink } from "@/lib/templates";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    if (!isAdmin(ctx.membership.role)) {
      return apiError("Only workspace owners and admins can revoke public links.", 403, "forbidden");
    }
    const { id } = await params;
    revokePublicLink(getDb(), ctx.workspace.id, id);
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
