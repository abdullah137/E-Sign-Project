import { z } from "zod";
import { apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { createUnit, createUnitsBulk, listUnits } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unitSchema = z.object({
  unitNumber: z.string().trim().min(1).max(40),
  unitType: z.string().trim().min(2).max(60),
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().int().min(0).max(50).optional(),
  toilets: z.number().int().min(0).max(50).optional(),
  occupancyStatus: z.enum(["available", "occupied", "maintenance"]).optional(),
  rentAmountCents: z.number().int().min(0).max(100_000_000),
  description: z.string().trim().max(1000).optional().nullable(),
});

const schema = z.union([
  z.object({ propertyId: z.string().min(1), units: z.array(unitSchema).min(1).max(100) }),
  z.object({ propertyId: z.string().min(1) }).and(unitSchema),
]);

export async function GET(request: Request) {
  try {
    const ctx = await requireApiContext();
    const propertyId = new URL(request.url).searchParams.get("propertyId") || undefined;
    return apiOk({ units: listUnits(getDb(), ctx.workspace.id, propertyId) });
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
    const actor = { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email };
    if ("units" in parsed.data) {
      const units = createUnitsBulk(getDb(), {
        workspaceId: ctx.workspace.id,
        propertyId: parsed.data.propertyId,
        units: parsed.data.units,
        actor,
      });
      return apiOk({ ok: true, units }, 201);
    }
    const { propertyId, ...unitInput } = parsed.data;
    const unit = createUnit(getDb(), {
      workspaceId: ctx.workspace.id,
      propertyId,
      actor,
      ...unitInput,
    });
    return apiOk({ ok: true, unit }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
