import type { Metadata } from "next";
import { isAdmin, requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listApiKeys } from "@/lib/workspace-admin";
import { listWorkspaceEmails } from "@/lib/email";
import { DevelopersPanel } from "@/components/settings/developers-panel";

export const metadata: Metadata = { title: "Developers" };
export const dynamic = "force-dynamic";

export default async function DevelopersSettingsPage() {
  const ctx = await requireWorkspace();
  const admin = isAdmin(ctx.membership.role);
  const db = getDb();
  const keys = admin ? listApiKeys(db, ctx.workspace.id) : [];
  const emails = admin ? listWorkspaceEmails(db, ctx.workspace.id, 20) : [];
  return <DevelopersPanel keys={keys} emails={emails} isAdmin={admin} />;
}
