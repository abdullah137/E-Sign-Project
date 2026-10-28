import { NextResponse } from "next/server";
import { assertSameOrigin, apiError, clientIp, handleRouteError, parseJsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { consumeAuthToken } from "@/lib/account";
import { hashPassword } from "@/lib/password";
import { invalidateUserSessions, createSession, SESSION_COOKIE } from "@/lib/auth";
import { resetSchema } from "@/lib/validation";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const db = getDb();
    const ip = clientIp(request);
    const limit = rateLimit(db, `reset:${ip ?? "unknown"}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return apiError("Too many reset attempts. Try again later.", 429, "rate_limited");
    }
    const parsed = await parseJsonBody(request, resetSchema);
    if ("response" in parsed) return parsed.response;
    const userId = consumeAuthToken(db, parsed.data.token, "reset_password");
    if (!userId) {
      return apiError("This reset link is invalid or has expired. Request a new one.", 400, "invalid_token");
    }
    db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(
      hashPassword(parsed.data.password),
      new Date().toISOString(),
      userId,
    );
    invalidateUserSessions(db, userId);
    const session = createSession(db, userId, {
      ip,
      userAgent: request.headers.get("user-agent"),
    });
    const response = NextResponse.json({ ok: true, redirect: "/app/dashboard" });
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
