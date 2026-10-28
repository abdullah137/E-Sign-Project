import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "./db";
import { addDaysIso, hashToken, newId, newToken, nowIso } from "./ids";
import { env } from "./env";
import { SESSION_COOKIE } from "./auth-constants";

export { SESSION_COOKIE };

export interface SessionUser {
  id: string;
  full_name: string;
  email: string;
  email_normalized: string;
  email_verified_at: string | null;
  created_at: string;
}

export interface WorkspaceRow {
  id: string;
  name: string;
  owner_id: string;
  plan: string;
  brand_display_name: string | null;
  brand_color: string | null;
  brand_logo_asset_id: string | null;
  created_at: string;
}

export interface MembershipRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  status: string;
}

export interface WorkspaceContext {
  user: SessionUser;
  workspace: WorkspaceRow;
  membership: MembershipRow;
}

export function createSession(
  db: DatabaseSync,
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): { token: string; expiresAt: string; maxAge: number } {
  const token = newToken(32);
  const expiresAt = addDaysIso(env.sessionTtlDays);
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(nowIso());
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_used_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId("ses"),
    userId,
    hashToken(token),
    nowIso(),
    expiresAt,
    nowIso(),
    meta.ip ?? null,
    meta.userAgent ?? null,
  );
  return { token, expiresAt, maxAge: env.sessionTtlDays * 86_400 };
}

export function destroySessionByToken(db: DatabaseSync, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export function invalidateUserSessions(db: DatabaseSync, userId: string, exceptToken?: string) {
  if (exceptToken) {
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").run(
      userId,
      hashToken(exceptToken),
    );
  } else {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.email_normalized, u.email_verified_at, u.created_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(hashToken(token)) as (SessionUser & { expires_at: string }) | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySessionByToken(db, token);
    return null;
  }
  db.prepare("UPDATE sessions SET last_used_at = ? WHERE token_hash = ?").run(
    nowIso(),
    hashToken(token),
  );
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    email_normalized: row.email_normalized,
    email_verified_at: row.email_verified_at,
    created_at: row.created_at,
  };
});

export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT w.*, m.id AS membership_id, m.role AS membership_role, m.status AS membership_status, m.user_id AS membership_user_id, m.workspace_id AS membership_workspace_id
       FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
       WHERE m.user_id = ? AND m.status = 'active'
       ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
       LIMIT 1`,
    )
    .get(user.id) as
    | (WorkspaceRow & {
        membership_id: string;
        membership_role: MembershipRow["role"];
        membership_status: string;
        membership_user_id: string;
        membership_workspace_id: string;
      })
    | undefined;
  if (!row) return null;
  return {
    user,
    workspace: {
      id: row.id,
      name: row.name,
      owner_id: row.owner_id,
      plan: row.plan,
      brand_display_name: row.brand_display_name,
      brand_color: row.brand_color,
      brand_logo_asset_id: row.brand_logo_asset_id,
      created_at: row.created_at,
    },
    membership: {
      id: row.membership_id,
      workspace_id: row.membership_workspace_id,
      user_id: row.membership_user_id,
      role: row.membership_role,
      status: row.membership_status,
    },
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  return user;
}

export async function requireVerifiedUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (!user.email_verified_at) redirect("/auth/verify-required");
  return user;
}

export async function requireWorkspace(): Promise<WorkspaceContext> {
  const user = await requireVerifiedUser();
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/auth/onboarding");
  return { ...ctx, user };
}

export function isAdmin(role: string): boolean {
  return role === "owner" || role === "admin";
}

export function isOwner(role: string): boolean {
  return role === "owner";
}

export function assertAdmin(ctx: WorkspaceContext): void {
  if (!isAdmin(ctx.membership.role)) {
    throw new Error("You do not have permission to perform this action.");
  }
}

export function displayName(user: { full_name: string; email: string }): string {
  return user.full_name.trim() || user.email;
}
