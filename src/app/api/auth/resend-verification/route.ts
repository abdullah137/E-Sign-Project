import { NextResponse } from "next/server";
import { assertSameOrigin, apiError, handleRouteError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/account";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) return apiError("Sign in to resend a verification email.", 401, "unauthorized");
    if (user.email_verified_at) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }
    const db = getDb();
    const limit = rateLimit(db, `verify-resend:${user.id}`, 3, 60 * 60 * 1000);
    if (!limit.allowed) {
      return apiError("Please wait before requesting another verification email.", 429, "rate_limited");
    }
    await sendVerificationEmail(db, user);
    return NextResponse.json({ ok: true, message: "Verification email sent." });
  } catch (error) {
    return handleRouteError(error);
  }
}
