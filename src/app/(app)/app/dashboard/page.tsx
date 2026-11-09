import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CreditCard,
  FilePlus2,
  FileSignature,
  FileText,
  PenLine,
} from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { expireStaleDocuments, getDashboardStats, listDocuments } from "@/lib/documents";
import { getPlan } from "@/lib/plans";
import { getTenancyStats, listInquiries, listPayments } from "@/lib/tenancy";
import { INQUIRY_STATUS_META } from "@/lib/tenancy-status";
import { PageHeader } from "@/components/ui/page-header";
import { buttonStyles } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/documents/metric-card";
import { DocumentTable } from "@/components/documents/document-table";
import { LiveRefresh } from "@/components/app/live-refresh";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, greeting } from "@/lib/format";
import { formatMoney } from "@/lib/tenancy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requireWorkspace();
  const db = getDb();
  expireStaleDocuments(db, ctx.workspace.id);
  const stats = getDashboardStats(db, ctx.workspace.id);
  const tenancy = getTenancyStats(db, ctx.workspace.id);
  const recentDocuments = listDocuments(db, ctx.workspace.id, { limit: 5, offset: 0 });
  const inquiries = listInquiries(db, ctx.workspace.id).slice(0, 6);
  const duePayments = listPayments(db, ctx.workspace.id)
    .filter((payment) => payment.status !== "PAID")
    .slice(0, 4);
  const plan = getPlan(ctx.workspace.plan);
  const firstName = (ctx.user.full_name || ctx.user.email).split(/\s+/)[0];
  const monthlyLimit = plan.entitlements.documentsPerMonth;
  const reviewCount = tenancy.submitted + tenancy.awaitingLandlord;

  return (
    <div className="page-container py-8 sm:py-10">
      {stats.pending > 0 ? <LiveRefresh /> : null}
      <PageHeader
        overline="Overview"
        title={`${greeting()}, ${firstName}`}
        description={
          reviewCount > 0
            ? `${tenancy.submitted} inquir${tenancy.submitted === 1 ? "y" : "ies"} to review and ${tenancy.awaitingLandlord} waiting on a landlord. ${tenancy.duePayments} payment${tenancy.duePayments === 1 ? "" : "s"} due.`
            : `Your tenancy pipeline is up to date. ${tenancy.properties} propert${tenancy.properties === 1 ? "y" : "ies"} and ${tenancy.agreements} agreement${tenancy.agreements === 1 ? "" : "s"} on file.`
        }
        actions={
          <>
            <Link href="/app/documents/new" className={buttonStyles("secondary", "md")}>
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              New document
            </Link>
            <Link href="/app/inquiries/new" className={buttonStyles("primary", "md")}>
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              New inquiry
            </Link>
          </>
        }
      />

      <section aria-label="Tenancy summary" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Inquiries to review"
          value={tenancy.submitted}
          hint="Submitted by tenants and waiting for your decision"
          icon={<ClipboardList className="h-4 w-4" strokeWidth={1.75} />}
          accent="gold"
          footer={
            <Link
              href="/app/inquiries"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gold-text hover:underline"
            >
              Review inquiries <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        />
        <MetricCard
          label="Waiting on landlords"
          value={tenancy.awaitingLandlord}
          hint="Forwarded inquiries awaiting a landlord decision"
          icon={<Building2 className="h-4 w-4" strokeWidth={1.75} />}
          footer={
            <Link
              href="/app/inquiries"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate hover:text-ink"
            >
              Track decisions <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        />
        <MetricCard
          label="Agreements"
          value={tenancy.agreements}
          hint="Prepared tenancy agreements and their signing status"
          icon={<FileSignature className="h-4 w-4" strokeWidth={1.75} />}
          footer={
            <Link
              href="/app/agreements"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate hover:text-ink"
            >
              Open agreements <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        />
        <MetricCard
          label="Payments due"
          value={tenancy.duePayments}
          hint="Offline rent or deposit records not yet marked paid"
          icon={<CreditCard className="h-4 w-4" strokeWidth={1.75} />}
          accent={tenancy.duePayments > 0 ? "gold" : "success"}
          footer={
            <Link
              href="/app/payments"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate hover:text-ink"
            >
              Record payments <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        />
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-hairline bg-surface px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-overline text-slate">Properties</p>
          <p className="mt-1 text-[22px] font-semibold text-ink tabular">{tenancy.properties}</p>
        </div>
        <div className="rounded-card border border-hairline bg-surface px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-overline text-slate">Landlords</p>
          <p className="mt-1 text-[22px] font-semibold text-ink tabular">{tenancy.landlords}</p>
        </div>
        <div className="rounded-card border border-hairline bg-surface px-5 py-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-overline text-slate">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            Renewals in 60 days
          </p>
          <p className="mt-1 text-[22px] font-semibold text-ink tabular">{tenancy.renewalsSoon}</p>
        </div>
      </div>

      <section className="mt-10" aria-labelledby="inquiries-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 id="inquiries-heading" className="font-serif text-[24px] leading-8 text-ink">
              Recent inquiries
            </h2>
            <p className="mt-0.5 text-[12.5px] text-slate">
              Tenant screening across every property in the workspace.
            </p>
          </div>
          <Link
            href="/app/inquiries"
            className="hidden items-center gap-1.5 text-[12.5px] font-semibold text-ink-secondary hover:text-ink sm:inline-flex"
          >
            View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {inquiries.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
            title="No tenant inquiries yet"
            description="Add a property, then send a private inquiry form to a prospective tenant."
            action={
              <Link href="/app/inquiries/new" className={buttonStyles("primary", "md")}>
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                Send an inquiry
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-card">
            {inquiries.map((inquiry) => {
              const meta = INQUIRY_STATUS_META[inquiry.status];
              return (
                <li key={inquiry.id}>
                  <Link
                    href={`/app/inquiries/${inquiry.id}`}
                    className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-surface-subtle sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{inquiry.applicant_name}</p>
                      <p className="truncate text-[12px] text-slate">
                        {inquiry.property_name} ({inquiry.property_reference}) · {inquiry.landlord_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={meta.tone} dot>
                        {meta.label}
                      </Badge>
                      <span className="text-[11.5px] text-slate">
                        {inquiry.submitted_at ? formatDate(inquiry.submitted_at) : "Awaiting form"}
                      </span>
                      <ArrowRight className="hidden h-4 w-4 text-slate sm:block" aria-hidden="true" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {duePayments.length > 0 ? (
        <section className="mt-10" aria-labelledby="payments-heading">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 id="payments-heading" className="font-serif text-[24px] leading-8 text-ink">
                Payments due
              </h2>
              <p className="mt-0.5 text-[12.5px] text-slate">Rent and charges recorded outside the platform.</p>
            </div>
            <Link href="/app/payments" className="text-[12.5px] font-semibold text-brand-text hover:underline">
              Open payments
            </Link>
          </div>
          <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-card">
            {duePayments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">{payment.description}</p>
                  <p className="truncate text-[12px] text-slate">
                    {payment.property_name ?? "No property"}
                    {payment.tenant_name ? ` · ${payment.tenant_name}` : ""} · due {formatDate(payment.due_date)}
                  </p>
                </div>
                <span className="text-[13px] font-semibold text-ink tabular">{formatMoney(payment.amount_cents)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="recent-documents-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 id="recent-documents-heading" className="font-serif text-[24px] leading-8 text-ink">
              Sign Flow activity
            </h2>
            <p className="mt-0.5 text-[12.5px] text-slate">Documents and agreements moving through signing.</p>
          </div>
          <Link
            href="/app/documents"
            className="hidden items-center gap-1.5 text-[12.5px] font-semibold text-ink-secondary hover:text-ink sm:inline-flex"
          >
            View all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {recentDocuments.items.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" aria-hidden="true" />}
            title="No documents yet"
            description="Upload a PDF, place fields for each recipient, and send a secure signing invitation."
            action={
              <Link href="/app/documents/new" className={buttonStyles("primary", "md")}>
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                Upload a PDF
              </Link>
            }
          />
        ) : (
          <DocumentTable documents={recentDocuments.items} />
        )}
      </section>

      <section className="mt-10 rounded-card border border-hairline bg-surface p-5 sm:p-6" aria-label="Document usage">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="overline">Sign Flow usage</p>
            <p className="mt-1.5 text-[13.5px] text-ink-secondary">
              <span className="tabular font-semibold text-ink">{stats.documentsThisMonth}</span>{" "}
              {monthlyLimit === null ? "documents sent" : `of ${monthlyLimit} documents used`} on the{" "}
              {plan.name} plan.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {monthlyLimit === null ? (
              <span className="text-[11.5px] font-medium text-success-text">Unlimited</span>
            ) : (
              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-muted" role="presentation">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{ width: `${Math.min(100, Math.round((stats.documentsThisMonth / monthlyLimit) * 100))}%` }}
                />
              </div>
            )}
            <Link
              href="/app/settings/billing"
              className="text-[12.5px] font-semibold text-gold-text hover:underline"
            >
              {plan.id === "free" ? "Compare plans" : "Manage plan"}
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <QuickLink
          href="/app/properties"
          icon={<Building2 className="h-4 w-4" aria-hidden="true" />}
          title="Properties"
          body="Address, rent and landlord profiles."
        />
        <QuickLink
          href="/app/precedents"
          icon={<FileSignature className="h-4 w-4" aria-hidden="true" />}
          title="Forms & precedents"
          body="Tenancy, company lease and other starting points."
        />
        <QuickLink
          href="/app/documents"
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          title="Signed documents"
          body="Completed originals and audit records."
        />
      </section>

      <p className="mt-8 flex items-center gap-2 text-[11.5px] text-slate">
        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
        Document sends reset monthly. Tenancy inquiries, properties and payments do not count against the document limit.
        <PenLine className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
      </p>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-card border border-hairline bg-surface p-4 transition-colors hover:border-brand-500"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-brand-text">
        {icon}
      </span>
      <p className="mt-3 text-[13.5px] font-semibold text-ink">{title}</p>
      <p className="mt-0.5 text-[12px] leading-5 text-slate">{body}</p>
    </Link>
  );
}
