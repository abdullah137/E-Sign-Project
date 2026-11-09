import { z } from "zod";
import { apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { deleteProperty, updateProperty } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  landlordId: z.string().min(1),
  reference: z.string().trim().max(40).optional().nullable(),
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(40),
  propertyType: z.string().trim().min(2).max(60),
  description: z.string().trim().max(1000).optional().nullable(),
  addressLine1: z.string().trim().min(3).max(200),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
  postalCode: z.string().trim().max(20).optional().nullable(),
  bedrooms: z.number().int().min(0).max(50),
  rentAmountCents: z.number().int().min(0).max(100_000_000),
  inquiryFeeCents: z.number().int().min(0).max(100_000_000).optional(),
  status: z.enum(["available", "occupied", "maintenance", "archived"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    const parsed = await parseJsonBody(request, schema);
    if ("response" in parsed) return parsed.response;
    const property = updateProperty(getDb(), {
      workspaceId: ctx.workspace.id,
      propertyId: id,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
      ...parsed.data,
    });
    return apiOk({ ok: true, property });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    deleteProperty(getDb(), {
      workspaceId: ctx.workspace.id,
      propertyId: id,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
    });
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
