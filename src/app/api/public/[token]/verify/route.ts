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
import { getPublicLinkContext, redeemPublicLink } from "@/lib/templates";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.string().trim().email("Enter a valid email address."),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the six-digit code from your email."),
});

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
    const perEmail = rateLimit(db, `public-verify:email:${lookup.link.id}:${email}`, 10, 15 * 60_000);
    if (!perEmail.allowed) {
      return apiError("Too many verification attempts. Request a new code later.", 429, "rate_limited");
    }
    const perIp = rateLimit(db, `public-verify:ip:${ip}`, 30, 60 * 60_000);
    if (!perIp.allowed) {
      return apiError("Too many requests from this network. Try again later.", 429, "rate_limited");
    }

    const result = await redeemPublicLink(db, {
      rawToken: token,
      name: parsed.data.name,
      email,
      code: parsed.data.code,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return apiOk({ ok: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
