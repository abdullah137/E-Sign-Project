import { apiError, apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { createTeamInvite } from "@/lib/workspace-admin";
import { teamInviteSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    if (!isAdmin(ctx.membership.role)) {
      return apiError("Only workspaces owners and admins can invite teammates.", 403, "forbidden");
    }
    const parsed = await parseJsonBody(request, teamInviteSchema);
    if ("response" in parsed) return parsed.response;
    const limit = rateLimit(getDb(), `team-invite:${ctx.workspace.id}`, 20, 60 * 60 * 1000);
    if (!limit.allowed) {
      return apiError("Too many invitations in a short period. Try again later.", 429, "rate_limited");
    }
    const db = getDb();
    const result = createTeamInvite(db, {
      workspaceId: ctx.workspace.id,
      workspaceName: ctx.workspace.brand_display_name || ctx.workspace.name,
      email: parsed.data.email,
      role: parsed.data.role,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
      plan: getPlan(ctx.workspace.plan),
    });
    return apiOk({
      ok: true,
      invite: result.invite,
      demoLink: env.showDevOutbox ? result.link : undefined,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
