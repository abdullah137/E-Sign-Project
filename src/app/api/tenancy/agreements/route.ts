import { z } from "zod";
import { apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { createAgreementFromPrecedent, listAgreements } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  inquiryId: z.string().min(1),
  precedentId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date."),
});

export async function GET() {
  try {
    const ctx = await requireApiContext();
    return apiOk({ agreements: listAgreements(getDb(), ctx.workspace.id) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    const parsed = await parseJsonBody(request, schema);
    if ("response" in parsed) return parsed.response;
    const result = await createAgreementFromPrecedent(getDb(), {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      userLabel: ctx.user.full_name || ctx.user.email,
      userEmail: ctx.user.email,
      ...parsed.data,
    });
    return apiOk(
      {
        ok: true,
        ...result,
        redirect: `/app/documents/${result.documentId}/prepare`,
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
