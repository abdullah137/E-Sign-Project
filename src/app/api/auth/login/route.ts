import { NextResponse } from "next/server";
import { assertSameOrigin, apiError, clientIp, handleRouteError, parseJsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { rateLimit, clearRateLimit } from "@/lib/rate-limit";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validation";
import { normalizeEmail } from "@/lib/ids";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const db = getDb();
    const ip = clientIp(request);
    const parsed = await parseJsonBody(request, loginSchema);
    if ("response" in parsed) return parsed.response;
    const emailNormalized = normalizeEmail(parsed.data.email);
    const ipLimit = rateLimit(db, `login-ip:${ip ?? "unknown"}`, 30, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      return apiError("Too many sign-in attempts. Try again in a few minutes.", 429, "rate_limited");
    }
    const emailLimit = rateLimit(db, `login-email:${emailNormalized}`, 8, 15 * 60 * 1000);
    if (!emailLimit.allowed) {
      return apiError(
        `Too many attempts for this account. Try again in ${Math.ceil(emailLimit.retryAfterSeconds / 60)} minutes.`,
        429,
        "rate_limited",
      );
    }
    const user = db
      .prepare("SELECT id, email, full_name, password_hash, email_verified_at FROM users WHERE email_normalized = ?")
      .get(emailNormalized) as
      | { id: string; email: string; full_name: string; password_hash: string; email_verified_at: string | null }
      | undefined;
    if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
      return apiError("Email or password is incorrect.", 401, "invalid_credentials");
    }
    clearRateLimit(db, `login-email:${emailNormalized}`);
    const session = createSession(db, user.id, {
      ip,
      userAgent: request.headers.get("user-agent"),
    });
    const response = NextResponse.json({
      ok: true,
      redirect: user.email_verified_at ? "/app/dashboard" : "/auth/verify-required",
    });
    response.cookies.set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.isProduction,
      path: "/",
      maxAge: session.maxAge,
    });
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
