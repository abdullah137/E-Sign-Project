import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listInquiries } from "@/lib/tenancy";
import { PageHeader } from "@/components/ui/page-header";
import { InquiriesPanel } from "@/components/tenancy/inquiries-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inquiries" };

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const ctx = await requireWorkspace();
  const db = getDb();
  const { propertyId } = await searchParams;
  const inquiries = listInquiries(db, ctx.workspace.id);

  return (
    <div className="page-container py-8 sm:py-10">
      <PageHeader
        overline="Tenant screening"
        title="Inquiries"
        description="Review each inquiry before it reaches the landlord. Once the landlord approves, prepare the agreement and send it for signature in order."
      />
      <div className="mt-8">
        <InquiriesPanel inquiries={inquiries} initialPropertyId={propertyId} />
      </div>
    </div>
  );
}
