import { z } from "zod";
import { apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { markPaymentPaid } from "@/lib/tenancy";

export const runtime = "nodejs";

const schema = z.object({
  method: z.string().trim().min(1).max(60),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    const parsed = await parseJsonBody(request, schema);
    if ("response" in parsed) return parsed.response;
    markPaymentPaid(getDb(), {
      workspaceId: ctx.workspace.id,
      paymentId: id,
      method: parsed.data.method,
      note: parsed.data.note,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
    });
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
