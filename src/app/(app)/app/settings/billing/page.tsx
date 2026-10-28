import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { countDocumentsThisMonth } from "@/lib/documents";
import { getBillingOverview } from "@/lib/workspace-admin";
import { BillingPanel } from "@/components/settings/billing-panel";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

export default async function BillingSettingsPage() {
  const ctx = await requireWorkspace();
  const db = getDb();
  const billing = getBillingOverview(
    db,
    ctx.workspace.id,
    countDocumentsThisMonth(db, ctx.workspace.id),
  );
  return <BillingPanel billing={billing} isOwner={ctx.membership.role === "owner"} />;
}
