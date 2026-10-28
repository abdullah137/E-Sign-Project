import { NextResponse } from "next/server";
import { assertSameOrigin, apiError, clientIp, handleRouteError, parseJsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { registerUser, sendVerificationEmail } from "@/lib/account";
import { registerSchema } from "@/lib/validation";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const db = getDb();
    const ip = clientIp(request);
    const limit = rateLimit(db, `register:${ip ?? "unknown"}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return apiError("Too many accounts created from this network. Try again later.", 429, "rate_limited");
    }
    const parsed = await parseJsonBody(request, registerSchema);
    if ("response" in parsed) return parsed.response;
    const { user } = registerUser(db, parsed.data);
    await sendVerificationEmail(db, user);
    const session = createSession(db, user.id, {
      ip,
      userAgent: request.headers.get("user-agent"),
    });
    const response = NextResponse.json({
      ok: true,
      redirect: "/auth/verify-required",
      user: { id: user.id, email: user.email, name: user.full_name },
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
