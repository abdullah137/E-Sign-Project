import { z } from "zod";
import { apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { deleteUnit, updateUnit } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  unitNumber: z.string().trim().min(1).max(40),
  unitType: z.string().trim().min(2).max(60),
  bedrooms: z.number().int().min(0).max(50),
  occupancyStatus: z.enum(["available", "occupied", "maintenance"]).optional(),
  rentAmountCents: z.number().int().min(0).max(100_000_000),
  description: z.string().trim().max(1000).optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    const parsed = await parseJsonBody(request, schema);
    if ("response" in parsed) return parsed.response;
    const unit = updateUnit(getDb(), {
      workspaceId: ctx.workspace.id,
      unitId: id,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
      ...parsed.data,
    });
    return apiOk({ ok: true, unit });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    deleteUnit(getDb(), {
      workspaceId: ctx.workspace.id,
      unitId: id,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
    });
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
