import { z } from "zod";
import { apiError, apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { createPublicLink, listPublicLinks } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  templateId: z.string().min(1),
  name: z.string().trim().min(2, "Give this link a name.").max(80),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});

export async function GET() {
  try {
    const ctx = await requireApiContext();
    return apiOk({ links: listPublicLinks(getDb(), ctx.workspace.id) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    if (!isAdmin(ctx.membership.role)) {
      return apiError("Only workspace owners and admins can create public links.", 403, "forbidden");
    }
    const parsed = await parseJsonBody(request, schema);
    if ("response" in parsed) return parsed.response;
    const link = createPublicLink(getDb(), {
      workspaceId: ctx.workspace.id,
      templateId: parsed.data.templateId,
      name: parsed.data.name,
      expiresInDays: parsed.data.expiresInDays,
    });
    return apiOk({ ok: true, link }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
