import { apiError, apiOk, assertSameOrigin, clientIp, handleRouteError, parseJsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSigningContext, recordConsent } from "@/lib/documents";
import { consentSchema } from "@/lib/validation";

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
    const parsed = await parseJsonBody(request, consentSchema);
    if ("response" in parsed) return parsed.response;
    recordConsent(db, token, {
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return apiOk({ ok: true, consentAt: new Date().toISOString() });
  } catch (error) {
    return handleRouteError(error);
  }
}
