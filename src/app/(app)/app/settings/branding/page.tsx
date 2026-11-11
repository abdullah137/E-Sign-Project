import type { Metadata } from "next";
import { isAdmin, requireWorkspace } from "@/lib/auth";
import { BrandingForm } from "@/components/settings/branding-form";

export const metadata: Metadata = { title: "Branding" };
export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage() {
  const ctx = await requireWorkspace();
  return (
    <BrandingForm
      workspaceName={ctx.workspace.name}
      brandDisplayName={ctx.workspace.brand_display_name}
      brandColor={ctx.workspace.brand_color}
      logoAssetId={ctx.workspace.brand_logo_asset_id}
      canEdit={isAdmin(ctx.membership.role)}
    />
  );
}
