import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  ClipboardList,
  CreditCard,
  FileSignature,
  LayoutTemplate,
  Lock,
  Minus,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { PLANS, PLAN_ORDER, formatPlanPrice } from "@/lib/plans";
import { env } from "@/lib/env";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Tenancy workflows, from inquiry to signature",
  description:
    "Screen prospective tenants, bring landlords into the decision without an account, and prepare agreements with integrated signing. Juripass keeps the property, the people and the evidence in one workspace.",
};

function InquiryPreview() {
  return (
    <div aria-hidden="true" className="rounded-xl border border-hairline bg-card p-3.5 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-ink">Tenant inquiry</span>
        <span className="text-[10px] text-slate">Submitted today</span>
      </div>
      <div className="mt-2.5 space-y-1">
        {[
          ["Applicant", "Priya Raman"],
          ["Income range", "60,000 – 99,999"],
          ["Guarantor", "Father · confirmed"],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-2 text-slate">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3 w-3 text-brand-600" aria-hidden="true" />
              {label}
            </span>
            <span className="text-ink-secondary">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LandlordPreview() {
  return (
    <div aria-hidden="true" className="rounded-xl border border-hairline bg-card p-3.5 text-[11px]">
      <div className="flex items-center justify-between gap-2 border-b border-hairline pb-2">
        <span className="font-semibold text-ink">Landlord review</span>
        <span className="rounded-pill bg-warning-bg px-2 py-0.5 text-[9.5px] font-semibold text-gold-text">
          Awaiting decision
        </span>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-slate">
        No account needed. Private link expires automatically.
      </p>
      <div className="mt-2 flex gap-1.5">
        <span className="rounded-md bg-brand-600 px-2 py-1 text-[9.5px] font-semibold text-white">Approve</span>
        <span className="rounded-md border border-hairline px-2 py-1 text-[9.5px] font-medium text-ink-secondary">
          Decline
        </span>
      </div>
    </div>
  );
}

function AgreementPreview() {
  return (
    <div aria-hidden="true" className="rounded-xl border border-hairline bg-card p-3.5 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-ink">Residential tenancy.pdf</span>
        <span className="text-[10px] text-slate">Signing in order</span>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        <span className="h-1.5 flex-1 rounded-full bg-brand-600" />
        <span className="h-1.5 flex-1 rounded-full bg-brand-600" />
        <span className="h-1.5 flex-1 rounded-full bg-brand-200" />
      </div>
      <div className="mt-2 space-y-0.5 text-[10px] text-slate">
        <p>Tenant · signed</p>
        <p>Guarantor · signed</p>
        <p>Landlord · invited after guarantor</p>
      </div>
    </div>
  );
}

function EvidencePreview() {
  return (
    <div aria-hidden="true" className="rounded-xl border border-hairline bg-card p-3.5 text-[11px]">
      <div className="flex items-center justify-between gap-2 border-b border-hairline pb-2">
        <span className="font-semibold text-ink">Audit trail</span>
        <span className="text-[10px] font-semibold text-brand-700">Chain verified</span>
      </div>
      <div className="mt-1.5 space-y-1">
        {[
          ["Inquiry submitted", "2:34"],
          ["Landlord approved", "4:02"],
          ["Agreement signed", "4:18"],
        ].map(([label, time]) => (
          <div key={label} className="flex items-center justify-between gap-2 text-slate">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3 w-3 text-brand-600" aria-hidden="true" />
              {label}
            </span>
            <span className="tabular">{time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrecedentPreview() {
  return (
    <div aria-hidden="true" className="grid grid-cols-2 gap-2 rounded-xl border border-hairline bg-card p-3 text-[10px]">
      {["Residential tenancy", "Company lease", "Banking facility", "Music performance"].map((name) => (
        <div
          key={name}
          className="rounded-lg border border-hairline bg-surface px-2 py-3 text-center font-medium text-ink-secondary"
        >
          {name}
        </div>
      ))}
    </div>
  );
}

const workflow = [
  {
    eyebrow: "Tenant inquiry",
    title: "Collect the right details once, then review.",
    body: "Send a private form for the applicant's household, employment, income range and guarantor contacts. The tenant submits and pays any inquiry fee by card from any device, without an account.",
    visual: <InquiryPreview />,
  },
  {
    eyebrow: "Landlord review",
    title: "Bring the landlord in without onboarding them.",
    body: "Approve the inquiry yourself first, then forward it with a private decision link. The landlord reviews the same details, approves or declines, and leaves a comment — no account required.",
    visual: <LandlordPreview />,
  },
  {
    eyebrow: "Agreements",
    title: "Prepare the agreement, then sign in order.",
    body: "Generate a prefilled agreement from a precedent, review the clauses, and invite the tenant, guarantor and landlord sequentially. Juripass Sign Flow handles consent, fields, reminders and finalization.",
    visual: <AgreementPreview />,
  },
  {
    eyebrow: "Evidence",
    title: "A record you can inspect, not just trust.",
    body: "Inquiry activity, landlord decisions, invitations, consent, field changes and signatures are recorded with server timestamps. Completed documents carry a hash-chained audit certificate.",
    visual: <EvidencePreview />,
  },
];

const premiumFeatures = [
  {
    icon: ClipboardList,
    title: "Tenant inquiry forms",
    body: "Household, employment, income ranges, guarantors and a per-property inquiry fee paid by card.",
  },
  {
    icon: Building2,
    title: "Properties & landlords",
    body: "One landlord can own several properties, each with address, rent and inquiry history.",
  },
  {
    icon: Users,
    title: "Landlord decisions",
    body: "Approve or decline from an expiring link, with a comment and no account to set up.",
  },
  {
    icon: BookOpen,
    title: "Precedent library",
    body: "Tenancy, company lease, banking, capital markets, music and legal services starting points.",
  },
  {
    icon: FileSignature,
    title: "Signing order",
    body: "Tenant, guarantor and landlord are invited in sequence with automatic hand-off.",
  },
  {
    icon: CreditCard,
    title: "Payments & renewals",
    body: "Record offline rent and deposits, then send renewal reminders from the agreement list.",
  },
  {
    icon: ScrollText,
    title: "Auditable records",
    body: "Private storage, hashed links, server-side permissions and a tamper-evident signing record.",
  },
  {
    icon: LayoutTemplate,
    title: "Reusable templates",
    body: "Save a prepared signing layout and reuse it without rebuilding fields.",
  },
];

const faqs = [
  {
    question: "Do tenants and landlords need a Juripass account?",
    answer: (
      <p>
        No. Tenants complete the inquiry from a private link, and landlords approve or decline from
        a separate expiring link. Both links are backed by high-entropy tokens stored hashed on the
        server. Neither role can browse the workspace, other properties or other applicants.
      </p>
    ),
  },
  {
    question: "Who reviews the tenant before the landlord?",
    answer: (
      <p>
        The lawyer or agency reviews every submitted inquiry first. Only an approved inquiry can be
        forwarded to the landlord. A landlord can then approve or decline with a comment. Neither
        decision creates a tenancy on its own.
      </p>
    ),
  },
  {
    question: "Does Juripass verify tenant information?",
    answer: (
      <p>
        Not automatically. Income, employment, identity and household details are self-reported,
        and applicants are told that deliberately false information may lead to the application
        being declined. Documents the workspace asks for separately are stored privately and are
        not a substitute for your own verification process.
      </p>
    ),
  },
  {
    question: "How are agreements prepared?",
    answer: (
      <p>
        After landlord approval, choose a precedent and the tenancy dates. Juripass generates a
        working draft prefilled with the property, rent, tenant, guarantor and landlord details,
        adds signature and date fields, and opens it in the field editor for review.
      </p>
    ),
  },
  {
    question: "How does signing in order work?",
    answer: (
      <p>
        The tenant is invited first. When the tenant completes, the guarantor is invited, and when
        the guarantor completes, the landlord is invited. Later signers cannot open or sign early,
        and the agreement is finalized only after every required signature is complete.
      </p>
    ),
  },
  {
    question: "Is data private and isolated?",
    answer: (
      <p>
        Properties, landlords, inquiries, agreements, documents and audit records are scoped to a
        workspace and checked on the server. Tokens are hashed, landlord documents stream only through
        permission-checked routes, and storage credentials are never sent to a browser.
      </p>
    ),
  },
  {
    question: "Are the agreements legally binding?",
    answer: (
      <p>
        Electronic signatures are recognised in many jurisdictions, but requirements differ by
        country, document type and circumstances. Precedents are working drafts, not legal advice.
        Juripass produces an evidentiary record; it does not guarantee enforceability. Obtain
        qualified counsel before relying on a signed agreement for a regulated or high-value matter.
      </p>
    ),
  },
];

export default function LandingPage() {
  return (
    <>
      <header className="hero-surface -mt-[72px] scroll-mt-24 pb-16 pt-[104px] text-center sm:pb-20">
        <div className="mx-auto w-full max-w-page px-6">
          {env.announcement.enabled ? (
            <Link
              href={env.announcement.href}
              className="inline-flex items-center gap-2 rounded-pill border border-brand-200 bg-card py-1 pl-1 pr-3.5 text-[13px] text-ink-secondary transition-colors duration-150 hover:border-brand-300"
            >
              <span className="rounded-md bg-brand-600 px-2 py-[2px] text-[11px] font-bold text-white">
                {env.announcement.label}
              </span>
              {env.announcement.message}
              <span aria-hidden="true">›</span>
            </Link>
          ) : null}

          <h1 className="mx-auto mt-6 max-w-4xl text-balance text-[clamp(38px,6vw,60px)] font-bold leading-[1.05] tracking-[-0.03em] text-ink">
            From tenant inquiry <br className="hidden sm:block" />
            <span className="text-brand-600">to signed agreement.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[540px] text-pretty text-[15px] leading-7 text-slate sm:text-[17px]">
            Screen tenants, let landlords decide from a private link and sign the tenancy in order
            — tenant, guarantor, landlord. Juripass keeps the property, the people and the
            evidence in one workspace.
          </p>
          <div className="mt-7">
            <Link
              href="/auth/register"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-pill bg-brand-600 px-6 text-[14px] font-semibold text-white transition-[background-color,box-shadow] duration-150 hover:bg-brand-700 hover:shadow-blue"
            >
              Start free
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <p className="mt-5 text-[12px] text-slate">
            No credit card required · Free plan available · Tenants and landlords never need an
            account
          </p>

          <div className="mt-14 sm:mt-16">
            <DashboardPreview />
          </div>
        </div>
      </header>

      <section id="solutions" className="scroll-mt-24 bg-bg">
        <div className="mx-auto w-full max-w-page px-6 py-24">
          <div className="mx-auto max-w-[560px] text-center">
            <h2 className="text-[30px] font-bold leading-[1.15] tracking-[-0.02em] text-ink sm:text-[34px]">
              From first inquiry to final signature
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-slate">
              One tenancy flow. The applicant, the landlord and every signature stay connected,
              and each material step is recorded with a server timestamp.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {workflow.map((block) => (
              <article
                key={block.eyebrow}
                className="flex flex-col rounded-card border border-hairline bg-card p-7"
              >
                <p className="text-[12px] font-semibold uppercase tracking-overline text-brand-700">
                  {block.eyebrow}
                </p>
                <h3 className="mt-2 text-[20px] font-bold leading-7 tracking-[-0.01em] text-ink">
                  {block.title}
                </h3>
                <p className="mt-2 flex-1 text-[14px] leading-6 text-slate">{block.body}</p>
                <div className="mt-5 rounded-xl border border-hairline bg-surface p-3.5">
                  {block.visual}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-24 bg-surface-subtle">
        <div className="mx-auto w-full max-w-page px-6 py-24">
          <div className="mx-auto max-w-[560px] text-center">
            <p className="text-[12px] font-semibold uppercase tracking-overline text-brand-700">
              Premium features
            </p>
            <h2 className="mt-3 text-[30px] font-bold leading-[1.15] tracking-[-0.02em] text-ink sm:text-[34px]">
              Everything you need, in every plan
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-slate">
              Properties, landlord decisions, precedent drafts and signing are part of the core
              product — not add-ons behind an enterprise call.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {premiumFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="flex gap-3 rounded-xl border border-hairline bg-card p-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-50 text-brand-600">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-[14px] font-bold text-ink">{feature.title}</h3>
                    <p className="mt-1 text-[12px] leading-5 text-slate">{feature.body}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="mx-auto mt-8 max-w-3xl text-center text-[11.5px] leading-6 text-slate">
            AI contract review, SMS delivery, bulk send and API document sends appear in the plan
            catalogue but are not implemented in this deployment yet.{" "}
            <Link
              href="/resources#roadmap"
              className="font-medium text-brand-700 underline-offset-2 hover:underline"
            >
              See the roadmap
            </Link>
            .
          </p>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 bg-bg">
        <div className="mx-auto w-full max-w-page px-6 py-24">
          <div className="mx-auto max-w-[560px] text-center">
            <h2 className="text-[30px] font-bold leading-[1.15] tracking-[-0.02em] text-ink sm:text-[34px]">
              Pricing on your terms
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-slate">
              Start free with unlimited inquiries and documents. Upgrade when you need more
              templates, team seats or unlimited retention.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {PLAN_ORDER.map((planId) => {
              const plan = PLANS[planId];
              const pending = new Set(plan.pendingFeatures);
              const paid = plan.priceMonthly > 0;
              return (
                <article
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-card bg-card p-7",
                    plan.popular
                      ? "border-2 border-brand-600 shadow-float"
                      : "border border-hairline",
                  )}
                >
                  {plan.popular ? (
                    <span className="absolute -top-3 right-5 rounded-pill bg-brand-600 px-3 py-0.5 text-[11px] font-semibold text-white">
                      Popular
                    </span>
                  ) : null}

                  <h3 className="text-[15px] font-bold text-ink">{plan.name}</h3>
                  <p className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-[36px] font-bold leading-none tracking-[-0.03em] text-ink">
                      {formatPlanPrice(plan)}
                    </span>
                    {paid ? <span className="text-[14px] text-slate">/month</span> : null}
                  </p>
                  <p className="mt-1.5 text-[13px] text-slate">{plan.blurb}</p>

                  <ul className="mt-5 flex-1 space-y-2.5 border-t border-hairline pt-5">
                    {plan.features.map((feature) => {
                      const isPending = pending.has(feature);
                      const isNegative = feature.startsWith("No ");
                      const FeatureIcon = isNegative ? Minus : Check;
                      return (
                        <li
                          key={feature}
                          className="flex items-start justify-between gap-2 text-[13.5px] leading-5"
                        >
                          <span className="flex gap-2.5">
                            <FeatureIcon
                              className={cn(
                                "mt-0.5 h-3.5 w-3.5 shrink-0",
                                isPending || isNegative ? "text-slate/60" : "text-brand-600",
                              )}
                              aria-hidden="true"
                            />
                            <span
                              className={
                                isPending || isNegative ? "text-slate" : "text-ink-secondary"
                              }
                            >
                              {feature}
                            </span>
                          </span>
                          {isPending ? (
                            <span className="mt-0.5 shrink-0 rounded-sm bg-brand-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.05em] text-brand-700">
                              Soon
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>

                  <Link
                    href={paid ? `/auth/register?plan=${plan.id}` : "/auth/register"}
                    className={cn(
                      "mt-6 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-md text-[14px] font-semibold transition-colors duration-150",
                      plan.popular
                        ? "bg-btn-dark text-btn-dark-text hover:opacity-90"
                        : "border border-hairline-strong bg-card text-ink hover:bg-surface-subtle",
                    )}
                  >
                    {plan.cta}
                  </Link>
                </article>
              );
            })}
          </div>

          <div className="mx-auto mt-8 max-w-3xl space-y-2 text-center">
            <p className="text-[11.5px] leading-5 text-slate">
              Prices are in Nigerian naira (NGN), billed monthly. “Soon” marks a catalogued feature that is not yet
              available in this deployment.
            </p>
            <p className="text-[11.5px] leading-5 text-slate">
              Paid plans are never activated just by clicking a pricing button. Selecting one
              records a request in Billing; no card is charged and no subscription starts
              automatically.
            </p>
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 bg-bg pb-24">
        <div className="mx-auto w-full max-w-[700px] px-6">
          <div className="text-center">
            <h2 className="text-[30px] font-bold leading-[1.15] tracking-[-0.02em] text-ink sm:text-[34px]">
              Frequently asked questions
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-slate">
              How inquiries, landlord decisions and signing work in Juripass.
            </p>
          </div>
          <div className="mt-8">
            <FaqAccordion items={faqs} />
          </div>
        </div>
      </section>

      <section className="cta-surface border-t border-hairline bg-bg">
        <div className="mx-auto w-full max-w-page px-6 py-24 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-card bg-brand-50 text-brand-600">
            <FileSignature className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <h2 className="mx-auto mt-5 max-w-2xl text-[30px] font-bold leading-[1.15] tracking-[-0.02em] text-ink sm:text-[36px]">
            Run your next tenancy{" "}
            <span className="border-b-[3px] border-brand-300 text-brand-600">in one place</span>
          </h2>
          <p className="mx-auto mt-4 max-w-[500px] text-[15px] leading-7 text-slate">
            Create a workspace, add a property and send your first inquiry in minutes. No card for
            the Free plan, and tenants and landlords never need an account.
          </p>

          <form
            action="/auth/register"
            method="get"
            className="mx-auto mt-8 flex max-w-[440px] items-center gap-1 rounded-pill border border-hairline bg-card p-1.5"
          >
            <label htmlFor="cta-email" className="sr-only">
              Work email
            </label>
            <input
              id="cta-email"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="Enter your email"
              className="h-10 min-w-0 flex-1 rounded-pill bg-transparent px-4 text-[14px] text-ink outline-none placeholder:text-placeholder"
            />
            <button
              type="submit"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-pill bg-btn-dark px-4 text-[13px] font-semibold text-btn-dark-text transition-opacity duration-150 hover:opacity-90"
            >
              Get started free
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-slate">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Tamper-evident signing record
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Private, expiring links
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-brand-600" aria-hidden="true" />
              No card required
            </span>
          </div>
          <p className="mt-5 text-[11px] text-slate">
            Juripass provides workflow and evidence tooling, not legal advice. Precedents are
            working drafts and electronic-signature requirements vary by jurisdiction.
          </p>
        </div>
      </section>
    </>
  );
}
