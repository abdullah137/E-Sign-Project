import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { getInquiry, getInquirySummaryPdf } from "@/lib/tenancy";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireApiContext();
    const db = getDb();
    const detail = getInquiry(db, ctx.workspace.id, id);
    const bytes = await getInquirySummaryPdf(db, {
      inquiry: detail.inquiry,
      property: detail.property,
      unit: detail.unit,
      landlord: detail.landlord,
      guarantors: detail.guarantors,
      workspaceName: ctx.workspace.brand_display_name || ctx.workspace.name,
    });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="tenant-inquiry-${detail.inquiry.id}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
