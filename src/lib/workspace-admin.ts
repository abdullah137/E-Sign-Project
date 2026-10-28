import type { DatabaseSync } from "node:sqlite";
import { addDaysIso, hashToken, newId, newToken, nowIso, normalizeEmail, sha256Hex } from "./ids";
import { hashPassword, verifyPassword } from "./password";
import { getPlan, type PlanDefinition } from "./plans";
import { appLink, queueEmail } from "./email";
import { transaction } from "./db";
import { isValidEmail } from "./field-types";
import { ConflictError, PermissionError, ValidationError } from "./errors";

export interface TeamMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: "admin" | "member";
  expiresAt: string;
  createdAt: string;
  invitedBy: string;
}

export function listTeamMembers(db: DatabaseSync, workspaceId: string): TeamMember[] {
  const rows = db
    .prepare(
      `SELECT m.id AS membership_id, m.role, m.created_at AS joined_at,
              u.id AS user_id, u.full_name, u.email
       FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.workspace_id = ? AND m.status = 'active'
       ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.created_at`,
    )
    .all(workspaceId) as unknown as Array<{
    membership_id: string;
    role: TeamMember["role"];
    joined_at: string;
    user_id: string;
    full_name: string;
    email: string;
  }>;
  return rows.map((row) => ({
    membershipId: row.membership_id,
    userId: row.user_id,
    name: row.full_name || row.email,
    email: row.email,
    role: row.role,
    joinedAt: row.joined_at,
  }));
}

export function listTeamInvites(db: DatabaseSync, workspaceId: string): TeamInvite[] {
  const rows = db
    .prepare(
      `SELECT i.id, i.email, i.role, i.expires_at, i.created_at, u.full_name AS inviter_name
       FROM workspace_invites i LEFT JOIN users u ON u.id = i.invited_by
       WHERE i.workspace_id = ? AND i.accepted_at IS NULL AND i.expires_at > ?
       ORDER BY i.created_at DESC`,
    )
    .all(workspaceId, nowIso()) as unknown as Array<{
    id: string;
    email: string;
    role: "admin" | "member";
    expires_at: string;
    created_at: string;
    inviter_name: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    invitedBy: row.inviter_name || "A teammate",
  }));
}

export function createTeamInvite(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    workspaceName: string;
    email: string;
    role: "admin" | "member";
    actor: { id: string; label: string };
    plan: PlanDefinition;
  },
): { invite: TeamInvite; link: string } {
  const email = input.email.trim();
  if (!isValidEmail(email)) throw new ValidationError("Enter a valid email address.");
  const normalized = normalizeEmail(email);
  const existing = db
    .prepare(
      `SELECT m.id FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.workspace_id = ? AND u.email_normalized = ?`,
    )
    .get(input.workspaceId, normalized);
  if (existing) throw new ConflictError("This person is already a member of the workspace.");
  const pending = db
    .prepare(
      `SELECT id FROM workspace_invites
       WHERE workspace_id = ? AND email_normalized = ? AND accepted_at IS NULL AND expires_at > ?`,
    )
    .get(input.workspaceId, normalized, nowIso());
  if (pending) throw new ConflictError("An invitation is already pending for this email address.");

  const members = db
    .prepare("SELECT COUNT(*) AS count FROM memberships WHERE workspace_id = ? AND status = 'active'")
    .get(input.workspaceId) as { count: number };
  const invites = db
    .prepare(
      "SELECT COUNT(*) AS count FROM workspace_invites WHERE workspace_id = ? AND accepted_at IS NULL AND expires_at > ?",
    )
    .get(input.workspaceId, nowIso()) as { count: number };
  if (Number(members.count) + Number(invites.count) >= input.plan.teamSeats) {
    throw new ConflictError(
      `The ${input.plan.name} plan includes ${input.plan.teamSeats} team seat${input.plan.teamSeats === 1 ? "" : "s"}. Upgrade to invite more people.`,
    );
  }

  const id = newId("invt");
  const token = newToken(32);
  const expiresAt = addDaysIso(7);
  db.prepare(
    `INSERT INTO workspace_invites
      (id, workspace_id, email, email_normalized, role, token_hash, invited_by, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.workspaceId,
    email,
    normalized,
    input.role,
    hashToken(token),
    input.actor.id,
    expiresAt,
    nowIso(),
  );
  const link = appLink(`/auth/register?invite=${encodeURIComponent(token)}`);
  queueEmail(db, {
    kind: "team_invite",
    to: email,
    subject: `${input.actor.label} invited you to ${input.workspaceName} on SignFlow`,
    heading: `Join ${input.workspaceName}`,
    intro: [
      `${input.actor.label} has invited you to collaborate in the ${input.workspaceName} workspace on SignFlow as ${input.role === "admin" ? "an admin" : "a member"}.`,
      "Create your account to prepare documents, send signature requests and follow signing activity. This invitation expires in seven days.",
    ],
    cta: { label: "Accept invitation", url: link },
    footnote: "If you were not expecting this invitation, you can ignore this message.",
    workspaceId: input.workspaceId,
    meta: { link },
  });
  return {
    invite: {
      id,
      email,
      role: input.role,
      expiresAt,
      createdAt: nowIso(),
      invitedBy: input.actor.label,
    },
    link,
  };
}

export function revokeTeamInvite(db: DatabaseSync, workspaceId: string, inviteId: string): void {
  const changed = db
    .prepare("DELETE FROM workspace_invites WHERE id = ? AND workspace_id = ? AND accepted_at IS NULL")
    .run(inviteId, workspaceId).changes;
  if (!changed) throw new ConflictError("This invitation has already been accepted or removed.");
}

export function updateTeamMemberRole(
  db: DatabaseSync,
  workspaceId: string,
  membershipId: string,
  role: "admin" | "member",
  actorUserId: string,
): void {
  const member = db
    .prepare("SELECT m.*, u.email FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.id = ? AND m.workspace_id = ?")
    .get(membershipId, workspaceId) as
    | { id: string; user_id: string; role: string; email: string }
    | undefined;
  if (!member) throw new ConflictError("That team member was not found.");
  if (member.role === "owner") throw new PermissionError("The workspace owner's role cannot be changed.");
  if (member.user_id === actorUserId) {
    throw new ValidationError("You cannot change your own role.");
  }
  db.prepare("UPDATE memberships SET role = ? WHERE id = ?").run(role, membershipId);
}

export function removeTeamMember(
  db: DatabaseSync,
  workspaceId: string,
  membershipId: string,
  actor: { userId: string; role: string },
): void {
  const member = db
    .prepare("SELECT * FROM memberships WHERE id = ? AND workspace_id = ?")
    .get(membershipId, workspaceId) as
    | { id: string; user_id: string; role: string }
    | undefined;
  if (!member) throw new ConflictError("That team member was not found.");
  if (member.role === "owner") throw new PermissionError("The workspace owner cannot be removed.");
  if (member.user_id === actor.userId) {
    throw new ValidationError("You cannot remove yourself from the workspace.");
  }
  if (actor.role !== "owner" && member.role !== "member") {
    throw new PermissionError("Only the workspace owner can remove an admin.");
  }
  db.prepare("DELETE FROM memberships WHERE id = ?").run(membershipId);
}

export function updateProfile(db: DatabaseSync, userId: string, fullName: string): void {
  const name = fullName.trim();
  if (name.length < 2) throw new ValidationError("Enter your name.");
  if (name.length > 80) throw new ValidationError("Your name must be 80 characters or fewer.");
  db.prepare("UPDATE users SET full_name = ?, updated_at = ? WHERE id = ?").run(name, nowIso(), userId);
}

export function changePassword(
  db: DatabaseSync,
  userId: string,
  currentPassword: string,
  newPassword: string,
  keepSessionToken?: string,
): void {
  const user = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(userId) as
    | { password_hash: string }
    | undefined;
  if (!user) throw new ConflictError("Account not found.");
  if (!verifyPassword(currentPassword, user.password_hash)) {
    throw new ValidationError("Your current password is not correct.");
  }
  if (newPassword.length < 8) throw new ValidationError("Use at least 8 characters for the new password.");
  if (newPassword.length > 128) throw new ValidationError("The new password is too long.");
  if (newPassword === currentPassword) {
    throw new ValidationError("Choose a password different from your current one.");
  }
  const passwordHash = hashPassword(newPassword);
  transaction(db, () => {
    db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(
      passwordHash,
      nowIso(),
      userId,
    );
    if (keepSessionToken) {
      db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").run(
        userId,
        hashToken(keepSessionToken),
      );
    } else {
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    }
  });
}

export interface SubscriptionSummary {
  plan: PlanDefinition;
  status: string;
  renewsAt: string | null;
  providerRef: string | null;
}

export interface InvoiceSummary {
  id: string;
  plan: string;
  amountCents: number;
  status: string;
  issuedAt: string;
}

export interface BillingOverview {
  plan: PlanDefinition;
  subscription: SubscriptionSummary;
  invoices: InvoiceSummary[];
  seatsUsed: number;
  seatsIncluded: number;
  documentsThisMonth: number;
}

export function getBillingOverview(
  db: DatabaseSync,
  workspaceId: string,
  documentsThisMonth: number,
): BillingOverview {
  const workspace = db.prepare("SELECT plan FROM workspaces WHERE id = ?").get(workspaceId) as
    | { plan: string }
    | undefined;
  if (!workspace) throw new ConflictError("Workspace not found.");
  const plan = getPlan(workspace.plan);
  const sub = db
    .prepare("SELECT * FROM subscriptions WHERE workspace_id = ?")
    .get(workspaceId) as
    | { plan: string; status: string; renews_at: string | null; provider_ref: string | null }
    | undefined;
  const invoices = db
    .prepare(
      "SELECT id, plan, amount_cents, status, issued_at FROM invoices WHERE workspace_id = ? ORDER BY issued_at DESC LIMIT 24",
    )
    .all(workspaceId) as unknown as Array<{
    id: string;
    plan: string;
    amount_cents: number;
    status: string;
    issued_at: string;
  }>;
  const seats = db
    .prepare("SELECT COUNT(*) AS count FROM memberships WHERE workspace_id = ? AND status = 'active'")
    .get(workspaceId) as { count: number };
  return {
    plan,
    subscription: {
      plan: getPlan(sub?.plan ?? workspace.plan),
      status: sub?.status ?? "active",
      renewsAt: sub?.renews_at ?? null,
      providerRef: sub?.provider_ref ?? null,
    },
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      plan: invoice.plan,
      amountCents: invoice.amount_cents,
      status: invoice.status,
      issuedAt: invoice.issued_at,
    })),
    seatsUsed: Number(seats.count),
    seatsIncluded: plan.teamSeats,
    documentsThisMonth,
  };
}

export function changePlan(
  db: DatabaseSync,
  workspaceId: string,
  planId: "free" | "pro" | "business",
): { plan: PlanDefinition; changed: boolean } {
  const plan = getPlan(planId);
  const workspace = db.prepare("SELECT plan FROM workspaces WHERE id = ?").get(workspaceId) as
    | { plan: string }
    | undefined;
  if (!workspace) throw new ConflictError("Workspace not found.");
  if (workspace.plan === plan.id) return { plan, changed: false };
  const seats = db
    .prepare("SELECT COUNT(*) AS count FROM memberships WHERE workspace_id = ? AND status = 'active'")
    .get(workspaceId) as { count: number };
  if (Number(seats.count) > plan.teamSeats) {
    throw new ConflictError(
      `This workspace has ${seats.count} members. The ${plan.name} plan includes ${plan.teamSeats} seat${plan.teamSeats === 1 ? "" : "s"}. Remove team members before downgrading.`,
    );
  }
  const now = nowIso();
  transaction(db, () => {
    db.prepare("UPDATE workspaces SET plan = ? WHERE id = ?").run(plan.id, workspaceId);
    db.prepare(
      `INSERT INTO subscriptions (workspace_id, plan, status, renews_at, updated_at)
       VALUES (?, ?, 'active', ?, ?)
       ON CONFLICT(workspace_id) DO UPDATE SET plan = excluded.plan, status = 'active', renews_at = excluded.renews_at, updated_at = excluded.updated_at`,
    ).run(workspaceId, plan.id, plan.priceMonthly > 0 ? addDaysIso(30) : null, now);
    if (plan.priceMonthly > 0) {
      db.prepare(
        "INSERT INTO invoices (id, workspace_id, plan, amount_cents, status, issued_at) VALUES (?, ?, ?, ?, 'paid', ?)",
      ).run(newId("inv"), workspaceId, plan.id, plan.priceMonthly * 100, now);
    }
  });
  return { plan, changed: true };
}

export function updateBranding(
  db: DatabaseSync,
  workspaceId: string,
  input: { name: string; brandDisplayName: string | null; brandColor: string | null },
): void {
  const name = input.name.trim();
  if (name.length < 2) throw new ValidationError("Enter a workspace name.");
  if (name.length > 80) throw new ValidationError("The workspace name must be 80 characters or fewer.");
  const display = input.brandDisplayName?.trim() || null;
  if (display && display.length > 80) {
    throw new ValidationError("The display name must be 80 characters or fewer.");
  }
  const color = input.brandColor?.trim() || null;
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new ValidationError("Choose a six-digit hex colour, for example #B89558.");
  }
  db.prepare(
    "UPDATE workspaces SET name = ?, brand_display_name = ?, brand_color = ? WHERE id = ?",
  ).run(name, display, color?.toUpperCase() ?? null, workspaceId);
}

export interface ApiKeySummary {
  id: string;
  label: string;
  prefix: string;
  scopes: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function listApiKeys(db: DatabaseSync, workspaceId: string): ApiKeySummary[] {
  const rows = db
    .prepare("SELECT * FROM api_keys WHERE workspace_id = ? ORDER BY created_at DESC")
    .all(workspaceId) as unknown as Array<{
    id: string;
    label: string;
    prefix: string;
    scopes: string;
    last_used_at: string | null;
    revoked_at: string | null;
    created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    prefix: row.prefix,
    scopes: row.scopes,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  }));
}

export function createApiKey(
  db: DatabaseSync,
  workspaceId: string,
  label: string,
): { id: string; key: string; prefix: string } {
  const cleanLabel = label.trim();
  if (cleanLabel.length < 2) throw new ValidationError("Give this key a label.");
  if (cleanLabel.length > 60) throw new ValidationError("The label must be 60 characters or fewer.");
  const active = db
    .prepare("SELECT COUNT(*) AS count FROM api_keys WHERE workspace_id = ? AND revoked_at IS NULL")
    .get(workspaceId) as { count: number };
  if (Number(active.count) >= 10) {
    throw new ConflictError("You can have at most 10 active API keys. Revoke one before creating another.");
  }
  const id = newId("key");
  const raw = `sf_live_${newToken(24)}`;
  const prefix = raw.slice(0, 15);
  db.prepare(
    `INSERT INTO api_keys (id, workspace_id, label, prefix, key_hash, scopes, created_at)
     VALUES (?, ?, ?, ?, ?, 'documents:read', ?)`,
  ).run(id, workspaceId, cleanLabel, prefix, sha256Hex(raw), nowIso());
  return { id, key: raw, prefix };
}

export function revokeApiKey(db: DatabaseSync, workspaceId: string, keyId: string): void {
  const changed = db
    .prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ? AND workspace_id = ? AND revoked_at IS NULL")
    .run(nowIso(), keyId, workspaceId).changes;
  if (!changed) throw new ConflictError("That key is already revoked or was not found.");
}

export function authenticateApiKey(
  db: DatabaseSync,
  rawKey: string,
): { workspaceId: string; keyId: string; scopes: string[] } {
  if (!rawKey.startsWith("sf_live_")) throw new PermissionError("Invalid API key.");
  const row = db
    .prepare("SELECT * FROM api_keys WHERE key_hash = ?")
    .get(sha256Hex(rawKey)) as
    | { id: string; workspace_id: string; scopes: string; revoked_at: string | null }
    | undefined;
  if (!row || row.revoked_at) throw new PermissionError("Invalid or revoked API key.");
  db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(nowIso(), row.id);
  return {
    workspaceId: row.workspace_id,
    keyId: row.id,
    scopes: row.scopes.split(",").map((scope) => scope.trim()),
  };
}
