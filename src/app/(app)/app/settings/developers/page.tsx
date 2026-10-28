import type { Metadata } from "next";
import { isAdmin, requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listApiKeys } from "@/lib/workspace-admin";
import { DevelopersPanel } from "@/components/settings/developers-panel";

export const metadata: Metadata = { title: "Developers" };
export const dynamic = "force-dynamic";

export default async function DevelopersSettingsPage() {
  const ctx = await requireWorkspace();
  const keys = isAdmin(ctx.membership.role) ? listApiKeys(getDb(), ctx.workspace.id) : [];
  return <DevelopersPanel keys={keys} isAdmin={isAdmin(ctx.membership.role)} />;
}
