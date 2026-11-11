import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PRECEDENTS } from "@/lib/precedents";
import { getInquiry, listCaseEvents, listUnits } from "@/lib/tenancy";
import { Breadcrumbs, PageHeader } from "@/components/ui/page-header";
import { InquiryDetail } from "@/components/tenancy/inquiry-detail";
import { INQUIRY_STATUS_META } from "@/lib/tenancy-status";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ctx = await requireWorkspace();
  try {
    const detail = getInquiry(getDb(), ctx.workspace.id, id);
    return { title: `${detail.inquiry.applicant_name} · Inquiry` };
  } catch {
    return { title: "Inquiry" };
  }
}

export default async function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireWorkspace();
  const db = getDb();

  const detail = (() => {
    try {
      return getInquiry(db, ctx.workspace.id, id);
    } catch {
      notFound();
    }
  })();

  const events = listCaseEvents(db, "inquiry", detail.inquiry.id);
  const units = listUnits(db, ctx.workspace.id, detail.property.id);
  const propertyAddress = [
    detail.property.address_line1,
    detail.property.city,
    detail.property.state,
    detail.property.postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="page-container py-8 sm:py-10">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: "Inquiries", href: "/app/inquiries" }, { label: detail.inquiry.applicant_name }]}
      />
      <PageHeader
        overline="Tenant inquiry"
        title={detail.inquiry.applicant_name}
        description={`${detail.property.name} (${detail.property.reference}) · ${INQUIRY_STATUS_META[detail.inquiry.status].label}`}
      />
      <div className="mt-8">
        <InquiryDetail
          inquiry={detail.inquiry}
          property={{
            id: detail.property.id,
            name: detail.property.name,
            reference: detail.property.reference,
            address: propertyAddress,
            bedrooms: detail.property.bedrooms,
            bathrooms: detail.property.bathrooms,
            listingType: detail.property.listing_type,
            rentAmountCents: detail.property.rent_amount_cents,
            defaultInquiryFeeCents: detail.property.inquiry_fee_cents,
          }}
          landlord={{
            id: detail.landlord.id,
            name: detail.landlord.name,
            email: detail.landlord.email,
            phone: detail.landlord.phone,
          }}
          unit={detail.unit}
          units={units}
          guarantors={detail.guarantors}
          files={detail.files}
          agreement={detail.agreement}
          events={events}
          precedents={PRECEDENTS.map((precedent) => ({
            id: precedent.id,
            title: precedent.title,
            category: precedent.category,
          }))}
        />
      </div>
    </div>
  );
}
