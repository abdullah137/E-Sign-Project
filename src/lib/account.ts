import type { DatabaseSync } from "node:sqlite";
import { addDaysIso, hashToken, newId, newToken, nowIso, normalizeEmail } from "./ids";
import { hashPassword } from "./password";
import { queueEmail, appLink } from "./email";
import { transaction } from "./db";
import { ConflictError, ValidationError } from "./errors";
import { isValidEmail } from "./field-types";

export type AuthTokenKind = "verify_email" | "reset_password";

export function issueAuthToken(
  db: DatabaseSync,
  userId: string,
  kind: AuthTokenKind,
  ttlHours: number,
): string {
  const raw = newToken(32);
  db.prepare(
    `INSERT INTO auth_tokens (id, user_id, kind, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(newId("tok"), userId, kind, hashToken(raw), addDaysIso(ttlHours / 24), nowIso());
  return raw;
}

export function consumeAuthToken(
  db: DatabaseSync,
  raw: string,
  kind: AuthTokenKind,
): string | null {
  const row = db
    .prepare("SELECT * FROM auth_tokens WHERE token_hash = ? AND kind = ?")
    .get(hashToken(raw), kind) as
    | { id: string; user_id: string; expires_at: string; used_at: string | null }
    | undefined;
  if (!row || row.used_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  const changed = db
    .prepare("UPDATE auth_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL")
    .run(nowIso(), row.id).changes;
  if (!changed) return null;
  return row.user_id;
}

export async function sendVerificationEmail(
  db: DatabaseSync,
  user: { id: string; full_name: string; email: string },
): Promise<string> {
  const token = issueAuthToken(db, user.id, "verify_email", 24);
  const link = appLink(`/auth/verify?token=${encodeURIComponent(token)}`);
  queueEmail(db, {
    kind: "verify_email",
    to: user.email,
    subject: "Verify your SignFlow email address",
    heading: "Confirm your email address",
    intro: [
      `Welcome to SignFlow, ${user.full_name || "there"}.`,
      "Verify your email address to create workspaces, send documents and track signatures.",
      "This link expires in 24 hours and can only be used once.",
    ],
    cta: { label: "Verify email", url: link },
    footnote: "If you did not create a SignFlow account, you can ignore this message.",
    meta: { link },
  });
  return link;
}

export async function sendPasswordResetEmail(
  db: DatabaseSync,
  user: { id: string; full_name: string; email: string },
): Promise<string> {
  db.prepare("UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND kind = 'reset_password' AND used_at IS NULL").run(
    nowIso(),
    user.id,
  );
  const token = issueAuthToken(db, user.id, "reset_password", 1);
  const link = appLink(`/auth/reset?token=${encodeURIComponent(token)}`);
  queueEmail(db, {
    kind: "reset_password",
    to: user.email,
    subject: "Reset your SignFlow password",
    heading: "Choose a new password",
    intro: [
      `Hello ${user.full_name || "there"}, we received a request to reset the password for your SignFlow account.`,
      "This link expires in one hour and can only be used once. If you did not request a reset, no action is required.",
    ],
    cta: { label: "Reset password", url: link },
    footnote: "For your security, existing sessions are signed out when the password changes.",
    meta: { link },
  });
  return link;
}

export interface RegisteredUser {
  id: string;
  full_name: string;
  email: string;
  email_normalized: string;
  email_verified_at: string | null;
}

export function registerUser(
  db: DatabaseSync,
  input: {
    fullName: string;
    email: string;
    password: string;
    workspaceName?: string;
    inviteToken?: string;
  },
): { user: RegisteredUser; workspaceId: string } {
  const emailNormalized = normalizeEmail(input.email);
  if (!isValidEmail(emailNormalized)) throw new ValidationError("Enter a valid email address.");
  const existing = db
    .prepare("SELECT id FROM users WHERE email_normalized = ?")
    .get(emailNormalized);
  if (existing) throw new ConflictError("An account with this email address already exists.");

  let invite:
    | { id: string; workspace_id: string; role: string; email_normalized: string; expires_at: string; accepted_at: string | null }
    | undefined;
  if (input.inviteToken) {
    invite = db
      .prepare("SELECT * FROM workspace_invites WHERE token_hash = ?")
      .get(hashToken(input.inviteToken)) as typeof invite;
    if (
      !invite ||
      invite.accepted_at ||
      new Date(invite.expires_at).getTime() < Date.now() ||
      invite.email_normalized !== emailNormalized
    ) {
      throw new ValidationError("This team invitation is invalid, expired, or belongs to another email address.");
    }
  }

  const userId = newId("usr");
  const workspaceId = invite ? invite.workspace_id : newId("wsp");
  const now = nowIso();
  const passwordHash = hashPassword(input.password);
  transaction(db, () => {
    db.prepare(
      `INSERT INTO users (id, full_name, email, email_normalized, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(userId, input.fullName.trim(), input.email.trim(), emailNormalized, passwordHash, now, now);

    if (invite) {
      db.prepare(
        `INSERT INTO memberships (id, workspace_id, user_id, role, status, invited_by, created_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      ).run(newId("mem"), workspaceId, userId, invite.role, null, now);
      db.prepare("UPDATE workspace_invites SET accepted_at = ? WHERE id = ?").run(now, invite.id);
    } else {
      const workspaceName =
        input.workspaceName?.trim() || `${input.fullName.trim().split(/\s+/)[0] || "My"} workspace`;
      db.prepare(
        `INSERT INTO workspaces (id, name, owner_id, plan, created_at)
         VALUES (?, ?, ?, 'free', ?)`,
      ).run(workspaceId, workspaceName, userId, now);
      db.prepare(
        `INSERT INTO memberships (id, workspace_id, user_id, role, status, created_at)
         VALUES (?, ?, ?, 'owner', 'active', ?)`,
      ).run(newId("mem"), workspaceId, userId, now);
      db.prepare(
        `INSERT INTO subscriptions (workspace_id, plan, status, updated_at)
         VALUES (?, 'free', 'active', ?)`,
      ).run(workspaceId, now);
    }
  });

  const user = db
    .prepare("SELECT id, full_name, email, email_normalized, email_verified_at FROM users WHERE id = ?")
    .get(userId) as unknown as RegisteredUser;
  return { user, workspaceId };
}
