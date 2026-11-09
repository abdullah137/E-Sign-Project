import { z } from "zod";
import { apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { deleteInquiry, updateInquiry } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  applicantName: z.string().trim().min(2).max(120),
  applicantEmail: z.string().trim().email().max(254),
  applicantPhone: z.string().trim().min(5).max(40),
  unitId: z.string().trim().max(80).optional().nullable(),
  lawyerNote: z.string().trim().max(1000).optional().nullable(),
  inquiryFeeCents: z.number().int().min(0).max(100_000_000).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    const parsed = await parseJsonBody(request, schema);
    if ("response" in parsed) return parsed.response;
    const inquiry = updateInquiry(getDb(), {
      workspaceId: ctx.workspace.id,
      inquiryId: id,
      name: parsed.data.applicantName,
      email: parsed.data.applicantEmail,
      phone: parsed.data.applicantPhone,
      unitId: parsed.data.unitId,
      lawyerNote: parsed.data.lawyerNote,
      inquiryFeeCents: parsed.data.inquiryFeeCents,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
    });
    return apiOk({ ok: true, inquiry });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const ctx = await requireApiContext();
    deleteInquiry(getDb(), {
      workspaceId: ctx.workspace.id,
      inquiryId: id,
      actor: { id: ctx.user.id, label: ctx.user.full_name || ctx.user.email },
    });
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
