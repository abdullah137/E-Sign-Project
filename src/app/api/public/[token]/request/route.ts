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
import { normalizeEmail } from "@/lib/ids";
import { rateLimit } from "@/lib/rate-limit";
import { getPublicLinkContext, queuePublicOtpEmail, requestPublicLinkOtp } from "@/lib/templates";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().trim().email("Enter a valid email address.") });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    assertSameOrigin(request);
    const { token } = await params;
    const db = getDb();
    const lookup = getPublicLinkContext(db, token);
    if (!lookup.ok) {
      return apiError("This public link is no longer available.", 410, "link_unavailable");
    }
    const parsed = await parseJsonBody(request, schema);
    if ("response" in parsed) return parsed.response;
    const email = normalizeEmail(parsed.data.email);
    const ip = clientIp(request) ?? "unknown";
    const perEmail = rateLimit(db, `public-otp:email:${lookup.link.id}:${email}`, 5, 15 * 60_000);
    if (!perEmail.allowed) {
      return apiError(
        "Too many codes requested. Wait a few minutes before trying again.",
        429,
        "rate_limited",
        { retryAfterSeconds: perEmail.retryAfterSeconds },
      );
    }
    const perIp = rateLimit(db, `public-otp:ip:${ip}`, 20, 60 * 60_000);
    if (!perIp.allowed) {
      return apiError("Too many requests from this network. Try again later.", 429, "rate_limited");
    }

    const otp = requestPublicLinkOtp(db, lookup.link, email);
    queuePublicOtpEmail(db, {
      workspaceId: lookup.link.workspace_id,
      linkName: lookup.link.name,
      workspaceName: lookup.workspace.brand_display_name || lookup.workspace.name,
      templateName: lookup.template.name,
      email,
      code: otp.code,
      expiresAt: otp.expiresAt,
    });
    return apiOk({ ok: true, expiresAt: otp.expiresAt });
  } catch (error) {
    return handleRouteError(error);
  }
}
