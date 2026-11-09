import { NextResponse } from "next/server";
import { apiError, handleRouteError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getInquiryByLandlordToken, getInquirySummaryPdf } from "@/lib/tenancy";

export const runtime = "nodejs";

function safeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "inquiry-summary";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const db = getDb();
    const lookup = getInquiryByLandlordToken(db, token);
    if (!lookup.ok) {
      return apiError("This review link is no longer available.", 410, "link_unavailable");
    }
    const { inquiry, property, unit, landlord, guarantors, workspace } = lookup.context;
    const bytes = await getInquirySummaryPdf(db, {
      inquiry,
      property,
      unit,
      landlord,
      guarantors,
      workspaceName: workspace.brand_display_name || workspace.name,
    });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="${safeFilename(
          `inquiry-${property.reference}-${inquiry.applicant_name}`,
        )}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
