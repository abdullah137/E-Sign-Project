import { NextResponse } from "next/server";
import { assertSameOrigin, apiError, clientIp, handleRouteError, parseJsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeEmail } from "@/lib/ids";
import { sendPasswordResetEmail } from "@/lib/account";
import { forgotSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const db = getDb();
    const ip = clientIp(request);
    const parsed = await parseJsonBody(request, forgotSchema);
    if ("response" in parsed) return parsed.response;
    const ipLimit = rateLimit(db, `forgot-ip:${ip ?? "unknown"}`, 10, 60 * 60 * 1000);
    if (!ipLimit.allowed) {
      return apiError("Too many reset requests. Try again later.", 429, "rate_limited");
    }
    const emailNormalized = normalizeEmail(parsed.data.email);
    const emailLimit = rateLimit(db, `forgot-email:${emailNormalized}`, 3, 60 * 60 * 1000);
    if (emailLimit.allowed) {
      const user = db
        .prepare("SELECT id, full_name, email FROM users WHERE email_normalized = ?")
        .get(emailNormalized) as { id: string; full_name: string; email: string } | undefined;
      if (user) await sendPasswordResetEmail(db, user);
    }
    return NextResponse.json({
      ok: true,
      message: "If an account exists for that email, a reset link is on its way.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
