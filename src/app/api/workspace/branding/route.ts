import { apiError, apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { updateBranding } from "@/lib/workspace-admin";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2, "Enter a workspace name.").max(80),
  brandDisplayName: z.string().trim().max(80).nullable().optional(),
  brandColor: z.string().trim().max(16).nullable().optional(),
});

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    if (!isAdmin(ctx.membership.role)) {
      return apiError("Only workspace owners and admins can change branding.", 403, "forbidden");
    }
    const parsed = await parseJsonBody(request, schema);
    if ("response" in parsed) return parsed.response;
    updateBranding(getDb(), ctx.workspace.id, {
      name: parsed.data.name,
      brandDisplayName: parsed.data.brandDisplayName ?? null,
      brandColor: parsed.data.brandColor ?? null,
    });
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
