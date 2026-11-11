import { z } from "zod";
import { apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { deletePayment, updatePayment } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  description: z.string().trim().min(2).max(160),
  amountCents: z.number().int().min(1).max(100_000_000),
  dueDate: z.string().trim().min(8).max(40),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    const parsed = await parseJsonBody(request, schema);
    if ("response" in parsed) return parsed.response;
    const payment = updatePayment(getDb(), {
      workspaceId: ctx.workspace.id,
      paymentId: id,
      ...parsed.data,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
    });
    return apiOk({ ok: true, payment });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    deletePayment(getDb(), {
      workspaceId: ctx.workspace.id,
      paymentId: id,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
    });
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
