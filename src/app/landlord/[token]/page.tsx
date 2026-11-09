import type { Metadata } from "next";
import { AlertTriangle, Clock3, Link2Off } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { PublicShell } from "@/components/tenancy/public-shell";
import { LandlordReview, type LandlordDecision } from "@/components/tenancy/landlord-review";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  formatMoney,
  getInquiryByLandlordToken,
  type PublicInquiryLookup,
} from "@/lib/tenancy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Landlord review",
  robots: { index: false, follow: false, nocache: true },
};

const INVALID_COPY: Record<
  Extract<PublicInquiryLookup, { ok: false }>["reason"],
  { title: string; body: string; icon: "clock" | "link" | "alert" }
> = {
  invalid: {
    title: "This link is not recognised",
    body: "The address may be incomplete or mistyped. Ask the lawyer or agency to resend the review link.",
    icon: "alert",
  },
  expired: {
    title: "This review link has expired",
    body: "Review links are valid for a limited time. Ask the lawyer to forward the inquiry again.",
    icon: "clock",
  },
  not_found: {
    title: "This inquiry is not available",
    body: "The property or workspace linked to this inquiry is no longer active. Contact the lawyer or agency.",
    icon: "link",
  },
};

export default async function LandlordReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const lookup = getInquiryByLandlordToken(db, token);

  if (!lookup.ok) {
    return <InvalidLink reason={lookup.reason} />;
  }

  const { inquiry, property, unit, landlord, guarantors, workspace } = lookup.context;
  const workspaceName = workspace.brand_display_name || workspace.name;
  const address = [property.address_line1, property.city, property.state, property.postal_code]
    .filter(Boolean)
    .join(", ");
  const unitLabel = unit ? `Unit ${unit.unit_number} · ${unit.unit_type}` : null;

  const decision: LandlordDecision =
    inquiry.status === "LANDLORD_APPROVED" || inquiry.status === "AGREEMENT_CREATED"
      ? "approve"
      : inquiry.status === "LANDLORD_DECLINED"
        ? "decline"
        : null;

  return (
    <PublicShell workspaceName={workspaceName}>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {inquiry.status === "LANDLORD_REVIEW" || decision ? (
          <LandlordReview
            token={token}
            workspaceName={workspaceName}
            propertyName={property.name}
            propertyReference={property.reference}
            propertyAddress={address}
            unitLabel={unitLabel}
            rentLabel={`${formatMoney(unit?.rent_amount_cents ?? property.rent_amount_cents)} per month`}
            applicantName={inquiry.applicant_name}
            applicantEmail={inquiry.applicant_email}
            applicantPhone={inquiry.applicant_phone}
            currentAddress={inquiry.current_address}
            reasonForMoving={inquiry.reason_for_moving}
            maritalStatus={inquiry.marital_status}
            childrenCount={inquiry.children_count}
            dependentsCount={inquiry.dependents_count}
            employmentStatus={inquiry.employment_status}
            employer={inquiry.employer}
            occupation={inquiry.occupation}
            incomeRange={inquiry.income_range}
            religionState={inquiry.religion_state}
            notes={inquiry.notes}
            guarantors={guarantors.map((guarantor) => ({
              name: guarantor.name,
              email: guarantor.email,
              relationship: guarantor.relationship,
            }))}
            submittedAtLabel={inquiry.submitted_at ? formatDate(inquiry.submitted_at) : null}
            decision={decision}
            landlordComment={inquiry.landlord_comment}
          />
        ) : (
          <div className="rounded-card border border-hairline bg-surface p-6 sm:p-9">
            <h1 className="font-serif text-[28px] leading-9 text-ink">This inquiry is not awaiting your decision</h1>
            <p className="mt-3 text-[13.5px] leading-6 text-slate">
              {workspaceName} has not forwarded {landlord.name}&apos;s inquiry for {property.name}
              at this stage, or the inquiry has already moved on. Contact the lawyer if you were
              expecting to review it.
            </p>
          </div>
        )}
      </main>
    </PublicShell>
  );
}

function InvalidLink({
  reason,
}: {
  reason: Extract<PublicInquiryLookup, { ok: false }>["reason"];
}) {
  const copy = INVALID_COPY[reason];
  const Icon = copy.icon === "clock" ? Clock3 : copy.icon === "link" ? Link2Off : AlertTriangle;
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-hairline bg-card">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-4 sm:px-6">
          <Logo href="/" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
        <div className="rounded-card border border-hairline bg-surface p-7 text-center sm:p-10">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-slate">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-serif text-[30px] leading-9 text-ink sm:text-[34px]">
            {copy.title}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[13px] leading-6 text-slate">{copy.body}</p>
        </div>
      </main>
    </div>
  );
}
