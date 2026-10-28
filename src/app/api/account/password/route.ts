import { cookies } from "next/headers";
import { apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { changePassword } from "@/lib/workspace-admin";
import { SESSION_COOKIE } from "@/lib/auth-constants";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(128),
  newPassword: z.string().min(8, "Use at least 8 characters.").max(128),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    const parsed = await parseJsonBody(request, schema);
    if ("response" in parsed) return parsed.response;
    const jar = await cookies();
    const currentToken = jar.get(SESSION_COOKIE)?.value;
    changePassword(
      getDb(),
      ctx.user.id,
      parsed.data.currentPassword,
      parsed.data.newPassword,
      currentToken,
    );
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
