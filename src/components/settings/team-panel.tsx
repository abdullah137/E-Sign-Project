"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, MailPlus, ShieldCheck, UserMinus, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/format";

export interface TeamMemberView {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
}

export interface TeamInviteView {
  id: string;
  email: string;
  role: "admin" | "member";
  expiresAt: string;
  createdAt: string;
  invitedBy: string;
}

export function TeamPanel({
  members,
  invites,
  currentUserId,
  currentRole,
  planName,
  seatsIncluded,
  seatsUsed,
}: {
  members: TeamMemberView[];
  invites: TeamInviteView[];
  currentUserId: string;
  currentRole: string;
  planName: string;
  seatsIncluded: number;
  seatsUsed: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const isOwner = currentRole === "owner";
  const canManage = isOwner || currentRole === "admin";
  const seatsFull = seatsUsed + invites.length >= seatsIncluded;

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [demoLink, setDemoLink] = useState<string | null>(null);

  const [removeTarget, setRemoveTarget] = useState<TeamMemberView | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<TeamInviteView | null>(null);
  const [roleSaving, setRoleSaving] = useState<string | null>(null);

  const sendInvite = async () => {
    setInviteSaving(true);
    setInviteError(null);
    try {
      const result = await apiFetch<{ demoLink?: string }>("/api/workspace/team/invite", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("member");
      setDemoLink(result.demoLink ?? null);
      toast({
        title: "Invitation sent",
        description: result.demoLink
          ? "Development mode: the invitation link is shown below instead of being emailed."
          : undefined,
        variant: "success",
      });
      router.refresh();
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "The invitation could not be sent.");
    } finally {
      setInviteSaving(false);
    }
  };

  const changeRole = async (member: TeamMemberView, role: "admin" | "member") => {
    setRoleSaving(member.membershipId);
    try {
      await apiFetch(`/api/workspace/team/member/${member.membershipId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      toast({ title: `${member.name} is now ${role === "admin" ? "an admin" : "a member"}`, variant: "success" });
      router.refresh();
    } catch (error) {
      toast({
        title: "Role not changed",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setRoleSaving(null);
    }
  };

  const removeMember = async () => {
    if (!removeTarget) return;
    await apiFetch(`/api/workspace/team/member/${removeTarget.membershipId}`, { method: "DELETE" });
    toast({ title: `${removeTarget.name} was removed`, variant: "success" });
    router.refresh();
  };

  const revokeInvite = async () => {
    if (!revokeTarget) return;
    await apiFetch(`/api/workspace/team/invite/${revokeTarget.id}`, { method: "DELETE" });
    toast({ title: "Invitation revoked", variant: "success" });
    router.refresh();
  };

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Link copied", variant: "success" });
    } catch {
      toast({ title: "Could not copy the link", description: link, variant: "error" });
    }
  };

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-subtle text-slate">
              <Users className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Team access</h2>
              <p className="mt-0.5 text-[12px] leading-5 text-slate">
                {seatsUsed} of {seatsIncluded} seats used on the {planName} plan
                {invites.length ? ` · ${invites.length} pending invitation${invites.length === 1 ? "" : "s"}` : ""}.
              </p>
            </div>
          </div>
          {canManage ? (
            <Button
              onClick={() => setInviteOpen(true)}
              disabled={seatsFull}
              title={seatsFull ? "All seats on this plan are in use." : undefined}
            >
              <MailPlus className="h-4 w-4" aria-hidden="true" />
              Invite teammate
            </Button>
          ) : null}
        </div>
        {seatsFull ? (
          <p className="mt-4 rounded border border-hairline bg-warning-bg/40 px-3.5 py-2.5 text-[12px] leading-5 text-gold-text">
            Every seat on the {planName} plan is assigned.{" "}
            {isOwner ? (
              <Link href="/app/settings/billing" className="font-semibold underline">
                Upgrade to add more people
              </Link>
            ) : (
              "Ask the workspace owner to upgrade the plan."
            )}
          </p>
        ) : null}

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[540px] border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline text-[10.5px] font-semibold uppercase tracking-overline text-slate">
                <th className="pb-2.5 pr-4 font-semibold">Member</th>
                <th className="pb-2.5 pr-4 font-semibold">Role</th>
                <th className="pb-2.5 pr-4 font-semibold">Joined</th>
                <th className="pb-2.5 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isSelf = member.userId === currentUserId;
                const canRemove =
                  canManage &&
                  member.role !== "owner" &&
                  !isSelf &&
                  (isOwner || member.role === "member");
                return (
                  <tr key={member.membershipId} className="border-b border-hairline/70 last:border-0">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={member.name} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink">
                            {member.name}
                            {isSelf ? <span className="ml-1.5 text-[11px] text-slate">(you)</span> : null}
                          </p>
                          <p className="truncate text-[11.5px] text-slate">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      {isOwner && member.role !== "owner" && !isSelf ? (
                        <Select
                          className="h-8 w-[126px] text-[12px]"
                          value={member.role}
                          disabled={roleSaving === member.membershipId}
                          onChange={(event) =>
                            void changeRole(member, event.target.value as "admin" | "member")
                          }
                          aria-label={`Role for ${member.name}`}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </Select>
                      ) : (
                        <Badge tone={member.role === "owner" ? "gold" : member.role === "admin" ? "neutral" : "muted"}>
                          {member.role === "owner" ? "Owner" : member.role === "admin" ? "Admin" : "Member"}
                        </Badge>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 text-[12px] text-slate">{formatDate(member.joinedAt)}</td>
                    <td className="py-3.5 text-right">
                      {canRemove ? (
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(member)}
                          className="inline-flex h-8 items-center gap-1.5 rounded px-2 text-[12px] font-medium text-slate hover:bg-[#FBEAEA] hover:text-danger"
                        >
                          <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                          Remove
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-start gap-2 rounded border border-hairline bg-surface-subtle/50 px-3.5 py-3 text-[11.5px] leading-5 text-slate">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-text" aria-hidden="true" />
          Owners manage billing and roles. Admins can prepare, send and manage documents plus invite
          members. Members can work with documents but cannot change workspace access.
        </div>
      </section>

      {demoLink ? (
        <section className="card border-gold/40 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-overline text-gold-text">
            Development invitation link
          </p>
          <p className="mt-1.5 text-[12px] leading-5 text-slate">
            Email delivery is captured in the local outbox in this deployment. Share this one-time
            link with the invitee:
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 overflow-x-auto rounded border border-hairline bg-surface-subtle px-3 py-2 text-[11px] text-ink-secondary">
              {demoLink}
            </code>
            <Button variant="secondary" size="sm" onClick={() => void copyLink(demoLink)}>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copy
            </Button>
          </div>
        </section>
      ) : null}

      {invites.length ? (
        <section className="card p-6">
          <h2 className="text-[15px] font-semibold text-ink">Pending invitations</h2>
          <p className="mt-0.5 text-[12px] text-slate">
            Invitations expire after seven days. Revoke one to free the seat immediately.
          </p>
          <ul className="mt-4 divide-y divide-hairline">
            {invites.map((invite) => (
              <li key={invite.id} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[13px] font-medium text-ink">{invite.email}</p>
                  <p className="text-[11.5px] text-slate">
                    {invite.role === "admin" ? "Admin" : "Member"} · invited by {invite.invitedBy} · expires{" "}
                    {formatDate(invite.expiresAt)}
                  </p>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => setRevokeTarget(invite)}
                    className="self-start text-[12px] font-medium text-slate underline-offset-2 hover:text-danger hover:underline sm:self-auto"
                  >
                    Revoke invitation
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Modal
        open={inviteOpen}
        onClose={() => (inviteSaving ? undefined : setInviteOpen(false))}
        title="Invite a teammate"
        description="They will join this workspace after creating an account with the invited email address."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)} disabled={inviteSaving}>
              Cancel
            </Button>
            <Button onClick={sendInvite} loading={inviteSaving} disabled={!inviteEmail.trim()}>
              Send invitation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="invite-email" required>
              Email address
            </Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="email"
              value={inviteEmail}
              onChange={(event) => {
                setInviteEmail(event.target.value);
                setInviteError(null);
              }}
              placeholder="colleague@company.com"
            />
          </div>
          <div>
            <Label htmlFor="invite-role">Role</Label>
            <Select
              id="invite-role"
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as "admin" | "member")}
            >
              <option value="member">Member — prepare and send documents</option>
              <option value="admin">Admin — also manage team access</option>
            </Select>
          </div>
          <FieldError>{inviteError}</FieldError>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={removeMember}
        title={`Remove ${removeTarget?.name ?? "this member"}?`}
        description="They will immediately lose access to this workspace. Documents and the audit trail remain intact."
        confirmLabel="Remove member"
      />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        onConfirm={revokeInvite}
        title="Revoke this invitation?"
        description="The invitation link will stop working and the seat will be freed."
        confirmLabel="Revoke invitation"
      />
    </div>
  );
}
