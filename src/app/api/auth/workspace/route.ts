import { NextResponse } from "next/server";
import { assertSameOrigin, apiError, handleRouteError, parseJsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { newId, nowIso } from "@/lib/ids";
import { workspaceNameSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) return apiError("Sign in first.", 401, "unauthorized");
    const db = getDb();
    const existing = db.prepare("SELECT id FROM memberships WHERE user_id = ?").get(user.id);
    if (existing) return apiError("You already belong to a workspace.", 409, "conflict");
    const parsed = await parseJsonBody(request, workspaceNameSchema);
    if ("response" in parsed) return parsed.response;
    const workspaceId = newId("wsp");
    const now = nowIso();
    transaction(db, () => {
      db.prepare(
        "INSERT INTO workspaces (id, name, owner_id, plan, created_at) VALUES (?, ?, ?, 'free', ?)",
      ).run(workspaceId, parsed.data.name, user.id, now);
      db.prepare(
        "INSERT INTO memberships (id, workspace_id, user_id, role, status, created_at) VALUES (?, ?, ?, 'owner', 'active', ?)",
      ).run(newId("mem"), workspaceId, user.id, now);
      db.prepare(
        "INSERT INTO subscriptions (workspace_id, plan, status, updated_at) VALUES (?, 'free', 'active', ?)",
      ).run(workspaceId, now);
    });
    return NextResponse.json({ ok: true, redirect: "/app/dashboard" });
  } catch (error) {
    return handleRouteError(error);
  }
}
