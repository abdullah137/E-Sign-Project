import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, Clock3, Link2Off } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { PublicShell } from "@/components/tenancy/public-shell";
import { TenantInquiryForm } from "@/components/tenancy/tenant-inquiry-form";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  formatMoney,
  getInquiryByTenantToken,
  inquiryFeeCentsFor,
  type InquiryStatus,
  type PublicInquiryLookup,
} from "@/lib/tenancy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tenant inquiry",
  robots: { index: false, follow: false, nocache: true },
};

const INVALID_COPY: Record<
  Extract<PublicInquiryLookup, { ok: false }>["reason"],
  { title: string; body: string; icon: "clock" | "link" | "alert" }
> = {
  invalid: {
    title: "This link is not recognised",
    body: "The address may be incomplete or mistyped. Ask the lawyer or agency to resend the inquiry link.",
    icon: "alert",
  },
  expired: {
    title: "This inquiry link has expired",
    body: "Inquiry links are valid for a limited time. Ask the sender for a fresh link so you can complete the form.",
    icon: "clock",
  },
  not_found: {
    title: "This inquiry is not available",
    body: "The property or workspace linked to this inquiry is no longer active. Contact the sender if you still need to apply.",
    icon: "link",
  },
};

const STATUS_COPY: Record<Exclude<InquiryStatus, "DRAFT">, string> = {
  SUBMITTED: "Your inquiry has been submitted and is waiting for the lawyer's review.",
  APPROVED: "Your inquiry passed the lawyer's review and is waiting for the landlord.",
  DECLINED: "This inquiry was not progressed by the lawyer. Contact them if you have questions.",
  LANDLORD_REVIEW: "The landlord is reviewing your inquiry.",
  LANDLORD_APPROVED:
    "The landlord approved your inquiry. The lawyer will prepare the tenancy agreement and send the signing steps.",
  LANDLORD_DECLINED: "The landlord declined this inquiry at this stage.",
  AGREEMENT_CREATED:
    "The tenancy agreement has been prepared. Signing steps are sent to the tenant, guarantor and landlord in order.",
};

export default async function TenantInquiryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const lookup = getInquiryByTenantToken(db, token);

  if (!lookup.ok) {
    return <InvalidLink reason={lookup.reason} />;
  }

  const { inquiry, property, unit, workspace } = lookup.context;
  const workspaceName = workspace.brand_display_name || workspace.name;
  const address = [property.address_line1, property.city, property.state, property.postal_code]
    .filter(Boolean)
    .join(", ");

  return (
    <PublicShell workspaceName={workspaceName}>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {inquiry.status === "DRAFT" ? (
          <TenantInquiryForm
            token={token}
            workspaceName={workspaceName}
            propertyName={property.name}
            propertyReference={property.reference}
            propertyAddress={address}
            rentLabel={`${formatMoney(unit?.rent_amount_cents || property.rent_amount_cents)} per year`}
            initialUnitId={inquiry.unit_id}
            applicantName={inquiry.applicant_name}
            applicantEmail={inquiry.applicant_email}
            applicantPhone={inquiry.applicant_phone}
            expiresAtLabel={
              inquiry.tenant_token_expires_at ? formatDate(inquiry.tenant_token_expires_at) : null
            }
            inquiryFeeCents={inquiryFeeCentsFor(inquiry, property)}
          />
        ) : (
          <div className="rounded-card border border-hairline bg-surface p-6 sm:p-9">
            <span
              className={
                inquiry.payment_status === "pending"
                  ? "flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-text"
                  : "flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-success-text"
              }
            >
              {inquiry.payment_status === "pending" ? (
                <Clock3 className="h-6 w-6" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              )}
            </span>
            <h1 className="mt-5 font-serif text-[30px] leading-9 text-ink">
              {inquiry.payment_status === "pending" ? "Inquiry awaiting payment" : "Inquiry already submitted"}
            </h1>
            <p className="mt-3 text-[14px] leading-6 text-slate">
              {inquiry.payment_status === "pending"
                ? `The ${formatMoney(inquiry.payment_fee_cents)} inquiry fee has not been confirmed yet. Complete the payment so ${workspaceName} can review your inquiry.`
                : STATUS_COPY[inquiry.status]}
            </p>
            <dl className="mt-6 grid gap-3 rounded-lg border border-hairline bg-card px-4 py-4 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-slate">Property</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {property.name} ({property.reference}){unit ? ` · Unit ${unit.unit_number}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-slate">Applicant</dt>
                <dd className="mt-0.5 font-medium text-ink">{inquiry.applicant_name}</dd>
              </div>
              <div>
                <dt className="text-slate">Submitted</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {inquiry.submitted_at ? formatDate(inquiry.submitted_at) : "Not recorded"}
                </dd>
              </div>
              <div>
                <dt className="text-slate">Workspace</dt>
                <dd className="mt-0.5 font-medium text-ink">{workspaceName}</dd>
              </div>
              {inquiry.payment_fee_cents > 0 ? (
                <div>
                  <dt className="text-slate">Inquiry fee</dt>
                  <dd className="mt-0.5 font-medium text-ink">
                    {formatMoney(inquiry.payment_fee_cents)} ·{" "}
                    {inquiry.payment_status === "paid"
                      ? "Paid"
                      : inquiry.payment_status === "failed"
                        ? "Failed"
                        : "Pending"}
                  </dd>
                </div>
              ) : null}
            </dl>
            {inquiry.payment_status === "pending" && inquiry.payment_url ? (
              <div className="mt-5 rounded-lg border border-hairline bg-card px-4 py-4">
                <p className="text-[13px] text-ink">
                  Fee due: <span className="font-semibold">{formatMoney(inquiry.payment_fee_cents)}</span>
                </p>
                {inquiry.payment_reference ? (
                  <p className="mt-1 break-all text-[11.5px] text-slate">Reference {inquiry.payment_reference}</p>
                ) : null}
                <a
                  href={inquiry.payment_url}
                  className="mt-3 inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-700"
                >
                  Continue to Paystack
                </a>
                <p className="mt-3 text-[11.5px] leading-5 text-slate">
                  Payments are processed by Paystack. This page updates once the payment is confirmed.
                </p>
              </div>
            ) : null}
            <p className="mt-5 text-[12.5px] leading-5 text-slate">
              To correct a detail or ask about the status, contact {workspaceName} directly. This
              link cannot be used to submit a second inquiry.
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
