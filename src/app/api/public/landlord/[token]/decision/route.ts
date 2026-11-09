import { z } from "zod";
import {
  apiError,
  apiOk,
  assertSameOrigin,
  clientIp,
  handleRouteError,
  parseJsonBody,
} from "@/lib/api";
import { getDb } from "@/lib/db";
import { hashToken } from "@/lib/ids";
import { rateLimit } from "@/lib/rate-limit";
import { landlordDecision } from "@/lib/tenancy";

export const runtime = "nodejs";

const schema = z.object({
  decision: z.enum(["approve", "decline"]),
  comment: z.string().trim().max(1000).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    assertSameOrigin(request);
    const { token } = await params;
    const db = getDb();

    const ip = clientIp(request) ?? "unknown";
    const perIp = rateLimit(db, `landlord-decision:ip:${ip}`, 20, 60 * 60_000);
    if (!perIp.allowed) {
      return apiError("Too many requests from this network. Try again later.", 429, "rate_limited");
    }
    const perToken = rateLimit(db, `landlord-decision:token:${hashToken(token)}`, 10, 60 * 60_000);
    if (!perToken.allowed) {
      return apiError(
        "Too many attempts for this review link. Wait a few minutes before trying again.",
        429,
        "rate_limited",
        { retryAfterSeconds: perToken.retryAfterSeconds },
      );
    }

    const parsed = await parseJsonBody(request, schema);
    if ("response" in parsed) return parsed.response;

    landlordDecision(db, {
      rawToken: token,
      decision: parsed.data.decision,
      comment: parsed.data.comment ?? null,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return apiOk({ ok: true, decision: parsed.data.decision });
  } catch (error) {
    return handleRouteError(error);
  }
}
