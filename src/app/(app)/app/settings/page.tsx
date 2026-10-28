import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth";
import { ProfileForm } from "@/components/settings/profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfileSettingsPage() {
  const ctx = await requireWorkspace();
  return (
    <ProfileForm
      initialName={ctx.user.full_name}
      email={ctx.user.email}
      memberSince={ctx.user.created_at}
      verified={Boolean(ctx.user.email_verified_at)}
      role={ctx.membership.role}
    />
  );
}
