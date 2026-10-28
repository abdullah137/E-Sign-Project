import { z } from "zod";
import { apiError, apiOk, assertSameOrigin, clientIp, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { createDocumentFromTemplate } from "@/lib/templates";

export const runtime = "nodejs";

const schema = z.object({
  title: z.string().trim().max(160).optional(),
  recipients: z
    .array(
      z.object({
        name: z.string().trim().max(120),
        email: z.string().trim().email("Enter a valid email address."),
      }),
    )
    .min(1)
    .max(25),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    const parsed = await parseJsonBody(request, schema);
    if ("response" in parsed) return parsed.response;
    const { id } = await params;
    const result = createDocumentFromTemplate(getDb(), {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      userLabel: ctx.user.full_name || ctx.user.email,
      templateId: id,
      title: parsed.data.title,
      recipients: parsed.data.recipients,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return apiOk({ ok: true, documentId: result.documentId }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
