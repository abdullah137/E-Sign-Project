import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { hashToken } from "@/lib/ids";
import { getSessionUser } from "@/lib/auth";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  if (await getSessionUser()) redirect("/app/dashboard");
  let inviteEmail: string | undefined;
  let inviteWorkspace: string | undefined;
  let validInvite: string | undefined;
  if (invite) {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT i.email, w.name AS workspace_name, i.expires_at, i.accepted_at
         FROM workspace_invites i JOIN workspaces w ON w.id = i.workspace_id
         WHERE i.token_hash = ?`,
      )
      .get(hashToken(invite)) as
      | { email: string; workspace_name: string; expires_at: string; accepted_at: string | null }
      | undefined;
    if (row && !row.accepted_at && new Date(row.expires_at).getTime() > Date.now()) {
      inviteEmail = row.email;
      inviteWorkspace = row.workspace_name;
      validInvite = invite;
    }
  }
  return (
    <RegisterForm
      inviteToken={validInvite}
      inviteEmail={inviteEmail}
      inviteWorkspace={inviteWorkspace}
    />
  );
}
