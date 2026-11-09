import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listLandlords, listProperties, listUnits } from "@/lib/tenancy";
import { PageHeader } from "@/components/ui/page-header";
import { PropertiesPanel } from "@/components/tenancy/properties-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Properties" };

export default async function PropertiesPage() {
  const ctx = await requireWorkspace();
  const db = getDb();
  const properties = listProperties(db, ctx.workspace.id);
  const landlords = listLandlords(db, ctx.workspace.id);
  const units = listUnits(db, ctx.workspace.id);

  return (
    <div className="page-container py-8 sm:py-10">
      <PageHeader
        overline="Property management"
        title="Properties"
        description="Each property keeps its address, rent and landlord contact in one place. Send a tenant inquiry, then prepare the agreement from the approved inquiry."
      />
      <div className="mt-8">
        <PropertiesPanel properties={properties} landlords={landlords} units={units} />
      </div>
    </div>
  );
}
