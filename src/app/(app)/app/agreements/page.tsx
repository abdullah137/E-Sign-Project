import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listAgreements } from "@/lib/tenancy";
import { PageHeader } from "@/components/ui/page-header";
import { AgreementsPanel } from "@/components/tenancy/agreements-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agreements" };

export default async function AgreementsPage() {
  const ctx = await requireWorkspace();
  const agreements = listAgreements(getDb(), ctx.workspace.id);

  return (
    <div className="page-container py-8 sm:py-10">
      <PageHeader
        overline="Tenancy agreements"
        title="Agreements"
        description="Prepared from an approved inquiry and signed in order: tenant, guarantor, then landlord. Completed agreements and their audit records stay in the workspace."
      />
      <div className="mt-8">
        <AgreementsPanel agreements={agreements} />
      </div>
    </div>
  );
}
