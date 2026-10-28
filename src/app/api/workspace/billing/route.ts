import { apiError, apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { isOwner } from "@/lib/auth";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { changePlan } from "@/lib/workspace-admin";
import { planSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    if (!isOwner(ctx.membership.role)) {
      return apiError("Only the workspace owner can change the plan.", 403, "forbidden");
    }
    const parsed = await parseJsonBody(request, planSchema);
    if ("response" in parsed) return parsed.response;
    const result = changePlan(getDb(), ctx.workspace.id, parsed.data.plan);
    return apiOk({ ok: true, plan: result.plan.id, changed: result.changed });
  } catch (error) {
    return handleRouteError(error);
  }
}
