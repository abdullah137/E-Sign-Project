import { z } from "zod";
import { apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { deleteLandlord, updateLandlord } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(5).max(40),
  notes: z.string().trim().max(1000).optional().nullable(),
  idType: z.string().trim().max(40).optional().nullable(),
  idNumber: z.string().trim().max(80).optional().nullable(),
  lawFirmName: z.string().trim().max(160).optional().nullable(),
  lawFirmAddress: z.string().trim().max(300).optional().nullable(),
  lawFirmPhone: z.string().trim().max(40).optional().nullable(),
  lawFirmEmail: z.string().trim().max(254).optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    const parsed = await parseJsonBody(request, schema);
    if ("response" in parsed) return parsed.response;
    const landlord = updateLandlord(getDb(), {
      workspaceId: ctx.workspace.id,
      landlordId: id,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
      ...parsed.data,
    });
    return apiOk({ ok: true, landlord });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    deleteLandlord(getDb(), {
      workspaceId: ctx.workspace.id,
      landlordId: id,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
    });
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
