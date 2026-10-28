import { apiError, apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { isAdmin, isOwner } from "@/lib/auth";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { removeTeamMember, updateTeamMemberRole } from "@/lib/workspace-admin";
import { updateMemberRoleSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    if (!isOwner(ctx.membership.role)) {
      return apiError("Only the workspace owner can change roles.", 403, "forbidden");
    }
    const { id } = await params;
    const parsed = await parseJsonBody(request, updateMemberRoleSchema);
    if ("response" in parsed) return parsed.response;
    updateTeamMemberRole(getDb(), ctx.workspace.id, id, parsed.data.role, ctx.user.id);
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    if (!isAdmin(ctx.membership.role)) {
      return apiError("Only workspace owners and admins can remove team members.", 403, "forbidden");
    }
    const { id } = await params;
    removeTeamMember(getDb(), ctx.workspace.id, id, {
      userId: ctx.user.id,
      role: ctx.membership.role,
    });
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
