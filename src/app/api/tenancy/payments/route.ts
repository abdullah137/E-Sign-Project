import { z } from "zod";
import { apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { createPayment, listPayments } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  agreementId: z.string().min(1).optional().nullable(),
  description: z.string().trim().min(2).max(160),
  amountCents: z.number().int().min(1).max(100_000_000),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date."),
});

export async function GET() {
  try {
    const ctx = await requireApiContext();
    return apiOk({ payments: listPayments(getDb(), ctx.workspace.id) });
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
    const payment = createPayment(getDb(), {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      userLabel: ctx.user.full_name || ctx.user.email,
      ...parsed.data,
    });
    return apiOk({ ok: true, payment }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
