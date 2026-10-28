import { apiError, apiOk, assertSameOrigin, clientIp, handleRouteError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSigningContext, markSignerOpened } from "@/lib/documents";

export const runtime = "nodejs";

const REASON_MESSAGES: Record<string, string> = {
  expired: "This signing link has expired. Ask the sender to send a new invitation.",
  voided: "This signing request was withdrawn by the sender.",
  declined: "This signing request was declined.",
  revoked: "This signing link is no longer active.",
};

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
      return apiError(
        REASON_MESSAGES[lookup.reason] ?? "This signing link is not valid.",
        410,
        lookup.reason,
      );
    }
    markSignerOpened(db, token, {
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
