import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertSameOrigin, handleRouteError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { destroySessionByToken, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) destroySessionByToken(getDb(), token);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
