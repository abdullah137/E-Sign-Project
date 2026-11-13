import { z } from "zod";
import { apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { createInquiry, listInquiries } from "@/lib/tenancy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  propertyId: z.string().min(1),
  unitId: z.string().trim().max(80).optional().nullable(),
  applicantName: z.string().trim().min(2).max(120),
  applicantEmail: z.string().trim().email().max(254),
  applicantPhone: z.string().trim().min(1).max(40),
  lawyerNote: z.string().trim().max(1000).optional().nullable(),
  inquiryFeeCents: z.number().int().min(0).max(100_000_000).optional().nullable(),
});

export async function GET() {
  try {
    const ctx = await requireApiContext();
    return apiOk({ inquiries: listInquiries(getDb(), ctx.workspace.id) });
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
    const result = createInquiry(getDb(), {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      userLabel: ctx.user.full_name || ctx.user.email,
      ...parsed.data,
    });
    return apiOk(
      {
        ok: true,
        inquiry: result.inquiry,
        demoLink: process.env.NODE_ENV !== "production" ? result.link : undefined,
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
