import { z } from "zod";
import { apiError, apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { createTemplateFromDocument, listTemplates } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  documentId: z.string().min(1),
  name: z.string().trim().min(2, "Give the template a name.").max(80),
  description: z.string().trim().max(280).nullable().optional(),
});

export async function GET() {
  try {
    const ctx = await requireApiContext();
    return apiOk({ templates: listTemplates(getDb(), ctx.workspace.id) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    if (!isAdmin(ctx.membership.role)) {
      return apiError("Only workspace owners and admins can create templates.", 403, "forbidden");
    }
    const parsed = await parseJsonBody(request, createSchema);
    if ("response" in parsed) return parsed.response;
    const template = createTemplateFromDocument(getDb(), {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      documentId: parsed.data.documentId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    });
    return apiOk({ ok: true, templateId: template.id }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
