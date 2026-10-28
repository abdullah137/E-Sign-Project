import { apiError, apiOk, assertSameOrigin, clientIp, handleRouteError, parseJsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { declineSigning, getSigningContext } from "@/lib/documents";
import { declineSchema } from "@/lib/validation";

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
    const parsed = await parseJsonBody(request, declineSchema);
    if ("response" in parsed) return parsed.response;
    await declineSigning(db, token, parsed.data.reason ?? null, {
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
