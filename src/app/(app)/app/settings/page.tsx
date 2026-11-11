import type { Metadata } from "next";
import { isAdmin, requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getPlanForWorkspace } from "@/lib/workspace-admin";
import { ProfileForm } from "@/components/settings/profile-form";
import { PayoutAccountForm } from "@/components/settings/payout-account-form";
import { BrandSetupCard } from "@/components/settings/brand-setup-card";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const ctx = await requireWorkspace();
  const canEdit = isAdmin(ctx.membership.role);
  const plan = getPlanForWorkspace(getDb(), ctx.workspace.id);

  return (
    <div className="space-y-6">
      <ProfileForm
        initialName={ctx.user.full_name}
        email={ctx.user.email}
        memberSince={ctx.user.created_at}
        verified={Boolean(ctx.user.email_verified_at)}
        role={ctx.membership.role}
      />
      {canEdit ? (
        <PayoutAccountForm
          canEdit
          initial={{
            bankName: ctx.workspace.bank_name ?? "",
            accountName: ctx.workspace.bank_account_name ?? "",
            accountNumber: ctx.workspace.bank_account_number ?? "",
            accountType: ctx.workspace.bank_account_type ?? "Savings",
          }}
        />
      ) : null}
      <BrandSetupCard
        workspaceName={ctx.workspace.name}
        displayName={ctx.workspace.brand_display_name}
        color={ctx.workspace.brand_color}
        hasLogo={Boolean(ctx.workspace.brand_logo_asset_id)}
        customBranding={plan.entitlements.customBranding}
      />
    </div>
  );
}
