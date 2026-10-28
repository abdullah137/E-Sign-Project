import { apiError, apiOk, assertSameOrigin, handleRouteError } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { revokeTeamInvite } from "@/lib/workspace-admin";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    if (!isAdmin(ctx.membership.role)) {
      return apiError("Only workspace owners and admins can manage invitations.", 403, "forbidden");
    }
    const { id } = await params;
    revokeTeamInvite(getDb(), ctx.workspace.id, id);
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
