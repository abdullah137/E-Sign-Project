import { apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { updateProfile } from "@/lib/workspace-admin";
import { profileSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    const parsed = await parseJsonBody(request, profileSchema);
    if ("response" in parsed) return parsed.response;
    updateProfile(getDb(), ctx.user.id, parsed.data.fullName);
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
