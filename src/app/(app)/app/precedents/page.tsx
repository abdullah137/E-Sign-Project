import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PRECEDENTS } from "@/lib/precedents";
import { listInquiries } from "@/lib/tenancy";
import { PageHeader } from "@/components/ui/page-header";
import { PrecedentsPanel } from "@/components/tenancy/precedents-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Forms & precedents" };

export default async function PrecedentsPage() {
  const ctx = await requireWorkspace();
  const db = getDb();
  const approved = listInquiries(db, ctx.workspace.id)
    .filter((inquiry) => inquiry.status === "LANDLORD_APPROVED")
    .map((inquiry) => ({
      id: inquiry.id,
      applicantName: inquiry.applicant_name,
      propertyName: inquiry.property_name,
    }));

  return (
    <div className="page-container py-8 sm:py-10">
      <PageHeader
        overline="Agreement library"
        title="Forms & precedents"
        description="Residential tenancy, company lease, banking, capital markets, music and legal services starting points. Preview the clauses, then generate an agreement from an approved inquiry."
      />
      <div className="mt-8">
        <PrecedentsPanel precedents={PRECEDENTS} approvedInquiries={approved} />
      </div>
    </div>
  );
}
