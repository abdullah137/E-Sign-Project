import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { listTeamInvites, listTeamMembers } from "@/lib/workspace-admin";
import { TeamPanel } from "@/components/settings/team-panel";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const ctx = await requireWorkspace();
  const db = getDb();
  const plan = getPlan(ctx.workspace.plan);
  const members = listTeamMembers(db, ctx.workspace.id);
  const invites = listTeamInvites(db, ctx.workspace.id);
  return (
    <TeamPanel
      members={members}
      invites={invites}
      currentUserId={ctx.user.id}
      currentRole={ctx.membership.role}
      planName={plan.name}
      seatsIncluded={plan.teamSeats}
      seatsUsed={members.length}
    />
  );
}
