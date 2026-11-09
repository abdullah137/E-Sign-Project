import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listLandlordFiles, listLandlords, listProperties } from "@/lib/tenancy";
import { PageHeader } from "@/components/ui/page-header";
import { LandlordsPanel } from "@/components/tenancy/landlords-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Landlords" };

export default async function LandlordsPage() {
  const ctx = await requireWorkspace();
  const db = getDb();
  const landlords = listLandlords(db, ctx.workspace.id);
  const propertyCounts = listProperties(db, ctx.workspace.id).reduce<Record<string, number>>(
    (counts, property) => {
      counts[property.landlord_id] = (counts[property.landlord_id] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const fileCounts = landlords.reduce<Record<string, number>>((counts, landlord) => {
    counts[landlord.id] = listLandlordFiles(db, landlord.id).length;
    return counts;
  }, {});

  return (
    <div className="page-container py-8 sm:py-10">
      <PageHeader
        overline="Property management"
        title="Landlords"
        description="Keep the owner's contact details on file. A landlord can own several properties and reviews each inquiry from a private link."
      />
      <div className="mt-8">
        <LandlordsPanel landlords={landlords} propertyCounts={propertyCounts} fileCounts={fileCounts} />
      </div>
    </div>
  );
}
