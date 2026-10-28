import { apiError, apiOk, assertSameOrigin, clientIp, handleRouteError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { completeSigning, getSigningContext } from "@/lib/documents";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    assertSameOrigin(request);
    const { token } = await params;
    const db = getDb();
    const lookup = getSigningContext(db, token);
    if (!lookup.ok) {
      return apiError("This signing link is no longer valid.", 410, lookup.reason);
    }
    const result = await completeSigning(db, token, {
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return apiOk({
      ok: true,
      ...result,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
