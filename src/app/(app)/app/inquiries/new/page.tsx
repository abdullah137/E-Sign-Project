import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listProperties, listUnits } from "@/lib/tenancy";
import { PageHeader } from "@/components/ui/page-header";
import { NewInquiryForm } from "@/components/tenancy/new-inquiry-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New inquiry" };

export default async function NewInquiryPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const ctx = await requireWorkspace();
  const db = getDb();
  const { propertyId } = await searchParams;
  const properties = listProperties(db, ctx.workspace.id).filter(
    (property) => property.status !== "archived",
  );
  const units = listUnits(db, ctx.workspace.id);

  return (
    <div className="page-container py-8 sm:py-10">
      <PageHeader
        overline="Tenant screening"
        title="New inquiry"
        description="Invite a tenant to complete the inquiry form. You review the submission before the landlord is involved."
      />
      <div className="mt-8">
        <NewInquiryForm properties={properties} units={units} initialPropertyId={propertyId} />
      </div>
    </div>
  );
}
