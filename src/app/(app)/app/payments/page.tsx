import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listAgreements, listPayments } from "@/lib/tenancy";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentsPanel } from "@/components/tenancy/payments-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const ctx = await requireWorkspace();
  const db = getDb();
  const payments = listPayments(db, ctx.workspace.id);
  const agreements = listAgreements(db, ctx.workspace.id).map((agreement) => ({
    id: agreement.id,
    title: agreement.title,
  }));

  return (
    <div className="page-container py-8 sm:py-10">
      <PageHeader
        overline="Rent tracking"
        title="Payments"
        description="Record rent, deposits and other charges paid outside the platform. Payment gateway integration is not enabled yet."
      />
      <div className="mt-8">
        <PaymentsPanel payments={payments} agreements={agreements} />
      </div>
    </div>
  );
}
