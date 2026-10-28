import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  FileSignature,
  Fingerprint,
  Layers,
  Link2,
  Lock,
  PenLine,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { buttonStyles } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "SignFlow — Sign with confidence",
  description:
    "Prepare, send, sign and track documents in one considered workspace. A modern electronic signature platform for professionals and teams.",
};

const steps = [
  {
    number: "01",
    title: "Prepare",
    body: "Upload a PDF and give the request a clear title. SignFlow records the file hash the moment it enters your workspace.",
    icon: FileSignature,
  },
  {
    number: "02",
    title: "Place fields",
    body: "Drag signature, date, name and custom fields onto every page. Assign them to recipients and mark which are required.",
    icon: PenLine,
  },
  {
    number: "03",
    title: "Send",
    body: "Recipients receive a private, expiring link. Each person sees only their own fields — no account required.",
    icon: Send,
  },
  {
    number: "04",
    title: "Track",
    body: "Watch progress in real time. When everyone has signed, the final PDF and hash-chained audit record are produced automatically.",
    icon: ShieldCheck,
  },
];

const features = [
  {
    icon: Layers,
    title: "A field editor built for precision",
    body: "Multi-page placement, drag to move, handles to resize, keyboard nudging and normalized coordinates that survive zoom, rotation and finalization.",
  },
  {
    icon: Fingerprint,
    title: "Signatures, three ways",
    body: "Recipients can type, draw or upload a signature. Every asset is scoped to its signer and embedded into the completed document.",
  },
  {
    icon: Link2,
    title: "Private signing links",
    body: "Cryptographically random tokens are stored only as hashes. Links expire, can be reminded and are revoked the moment a request is voided.",
  },
  {
    icon: ShieldCheck,
    title: "Evidence worth inspecting",
    body: "Every invitation, view, consent, signature and download is appended to a hash-chained audit trail with timestamps and actor details.",
  },
  {
    icon: Users,
    title: "Team-ready from the start",
    body: "Role-aware workspaces keep documents, templates and billing inside the right organization — with server-side permission checks throughout.",
  },
  {
    icon: CheckCircle2,
    title: "Required-field enforcement",
    body: "Signers can't complete until every required field is valid. Sender-side validation blocks a send before a recipient ever sees it.",
  },
];

const faqs = [
  {
    question: "Do recipients need a SignFlow account?",
    answer:
      "No. Recipients open a private link, review the document, consent to electronic signing and complete their fields. Senders and teammates work inside a workspace, but signing is deliberately account-free.",
  },
  {
    question: "What evidence is captured for each signature?",
    answer:
      "Each request records invitations, opens, consent version, field values, signature assets, completion time and downloads in an append-only audit trail. Entries are hash-chained so tampering is detectable, and the completed PDF carries its own SHA-256 digest.",
  },
  {
    question: "Is an electronic signature legally binding?",
    answer:
      "Electronic signatures are recognised in many jurisdictions, but requirements vary by country, industry and document type. SignFlow produces a detailed evidentiary record; it does not provide legal advice or guarantee that a document is enforceable in your jurisdiction. Consult qualified counsel for regulated or high-value agreements.",
  },
  {
    question: "Can I try it without sending a real document?",
    answer:
      "Yes. Create a free workspace, upload a PDF and walk through preparation and signing with your own email address. In development builds, invitation and verification links are also visible in the local email outbox.",
  },
];

export default function LandingPage() {
  return (
    <div className="bg-bg">
      <header className="sticky top-0 z-40 border-b border-hairline bg-[rgba(248,249,250,0.9)] backdrop-blur-md">
        <div className="page-container flex h-[68px] items-center justify-between gap-6">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
            <a href="#how-it-works" className="text-[13px] font-medium text-slate hover:text-ink">
              How it works
            </a>
            <a href="#platform" className="text-[13px] font-medium text-slate hover:text-ink">
              Platform
            </a>
            <a href="#security" className="text-[13px] font-medium text-slate hover:text-ink">
              Security
            </a>
            <a href="#pricing" className="text-[13px] font-medium text-slate hover:text-ink">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/auth/login" className={buttonStyles("ghost", "sm")}>
              Sign in
            </Link>
            <Link href="/auth/register" className={buttonStyles("primary", "sm")}>
              Start free
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="page-container pb-16 pt-14 sm:pb-24 sm:pt-20 lg:pb-28 lg:pt-24">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:gap-16">
            <div>
              <p className="inline-flex items-center gap-2 rounded-pill border border-hairline bg-surface px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-overline text-gold-text">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
                Electronic signatures, considered
              </p>
              <h1 className="mt-6 max-w-2xl font-serif text-[44px] leading-[1.06] tracking-[-0.02em] text-ink sm:text-[58px] lg:text-[64px]">
                Signatures that hold their composure.
              </h1>
              <p className="mt-6 max-w-xl text-[15px] leading-7 text-slate sm:text-[16px]">
                SignFlow is a calm, precise workspace for preparing, sending and signing
                important documents. Place fields with care, invite recipients without
                accounts, and keep an evidence trail you can actually inspect.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/auth/register" className={buttonStyles("primary", "lg")}>
                  Start signing free
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href="#how-it-works" className={buttonStyles("secondary", "lg")}>
                  See how it works
                </a>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-slate">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-gold-text" aria-hidden="true" />
                  No credit card
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-gold-text" aria-hidden="true" />
                  Recipients need no account
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-gold-text" aria-hidden="true" />
                  Hash-chained audit trail
                </span>
              </div>
            </div>

            <div className="relative" aria-hidden="true">
              <div className="absolute -inset-x-6 -top-6 bottom-10 rounded-[16px] border border-hairline bg-surface-subtle/60" />
              <div className="relative overflow-hidden rounded-card border border-hairline bg-surface shadow-float">
                <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-6 items-center justify-center rounded-sm border border-[rgba(18,20,23,0.16)] bg-surface">
                      <FileSignature className="h-3.5 w-3.5 text-gold-text" strokeWidth={1.6} />
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-overline text-slate">
                      Employment agreement
                    </span>
                  </div>
                  <span className="rounded-pill bg-warning-bg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gold-text">
                    Awaiting signature
                  </span>
                </div>
                <div className="grid grid-cols-[78px_minmax(0,1fr)]">
                  <div className="space-y-5 border-r border-hairline bg-surface-subtle/50 px-3 py-5">
                    {[0, 1, 2, 3].map((item) => (
                      <div key={item} className="space-y-1.5">
                        <div className="h-1.5 w-full rounded-full bg-[rgba(18,20,23,0.1)]" />
                        <div className="h-1.5 w-4/5 rounded-full bg-[rgba(18,20,23,0.06)]" />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4 p-5">
                    <div className="h-2 w-2/3 rounded-full bg-[rgba(18,20,23,0.14)]" />
                    <div className="space-y-1.5">
                      <div className="h-1.5 w-full rounded-full bg-[rgba(18,20,23,0.07)]" />
                      <div className="h-1.5 w-full rounded-full bg-[rgba(18,20,23,0.07)]" />
                      <div className="h-1.5 w-5/6 rounded-full bg-[rgba(18,20,23,0.07)]" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-1.5 w-full rounded-full bg-[rgba(18,20,23,0.07)]" />
                      <div className="h-1.5 w-3/4 rounded-full bg-[rgba(18,20,23,0.07)]" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="rounded border border-gold bg-warning-bg/40 px-2.5 py-2">
                        <p className="text-[8px] font-semibold uppercase tracking-wide text-gold-text">
                          Signature *
                        </p>
                        <p className="mt-1 font-serif text-[15px] italic leading-none text-ink">
                          Amelia Hart
                        </p>
                      </div>
                      <div className="rounded border border-[rgba(40,93,57,0.35)] bg-success-bg/40 px-2.5 py-2">
                        <p className="text-[8px] font-semibold uppercase tracking-wide text-success-text">
                          Date *
                        </p>
                        <p className="tabular mt-1 text-[11px] leading-none text-ink">27 Oct 2026</p>
                      </div>
                    </div>
                    <div className="mt-2 rounded border border-hairline bg-surface-subtle/60 px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-slate">
                          Audit record
                        </span>
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-success-text">
                          <ShieldCheck className="h-2.5 w-2.5" /> Chain verified
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-[8px] text-slate">
                        <span>Invited 09:14</span>
                        <span>Opened 09:22</span>
                        <span>Consent 09:23</span>
                        <span>Signed 09:31</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-hairline bg-surface" aria-label="Product principles">
          <div className="page-container grid gap-8 py-9 sm:grid-cols-3">
            {[
              { value: "Normalized", label: "Field geometry across zoom and page rotation" },
              { value: "Hash-chained", label: "Append-only audit events for every request" },
              { value: "Recipient-scoped", label: "Each signer sees only their own assigned fields" },
            ].map((item) => (
              <div key={item.value} className="flex items-start gap-4">
                <span className="mt-1 h-8 w-px bg-gold" aria-hidden="true" />
                <div>
                  <p className="font-serif text-[20px] leading-6 text-ink">{item.value}</p>
                  <p className="mt-1 max-w-[260px] text-[12px] leading-5 text-slate">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="page-container scroll-mt-24 py-20 sm:py-24">
          <div className="max-w-2xl">
            <p className="overline">How it works</p>
            <h2 className="mt-3 font-serif text-[34px] leading-[1.15] tracking-[-0.01em] text-ink sm:text-[42px]">
              Four steps, no ceremony lost.
            </h2>
            <p className="mt-4 text-[14.5px] leading-7 text-slate">
              Every step is visible and reversible until you send. After that, each action is
              recorded so the record speaks for itself.
            </p>
          </div>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <li key={step.number} className="card relative flex flex-col p-6">
                <div className="flex items-center justify-between">
                  <span className="tabular font-serif text-[30px] leading-none text-gold">
                    {step.number}
                  </span>
                  <step.icon className="h-5 w-5 text-slate" strokeWidth={1.6} aria-hidden="true" />
                </div>
                <h3 className="mt-6 text-[15px] font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-[12.5px] leading-6 text-slate">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="platform" className="scroll-mt-24 border-y border-hairline bg-surface py-20 sm:py-24">
          <div className="page-container">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-xl">
                <p className="overline">The platform</p>
                <h2 className="mt-3 font-serif text-[34px] leading-[1.15] tracking-[-0.01em] text-ink sm:text-[42px]">
                  Detail where it matters. Quiet everywhere else.
                </h2>
              </div>
              <p className="max-w-sm text-[13px] leading-6 text-slate">
                The essentials are complete and working — including the parts most tools gloss
                over, like rotation-aware field placement and evidence integrity.
              </p>
            </div>
            <div className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} className="border-t border-hairline pt-6">
                  <feature.icon className="h-5 w-5 text-gold-text" strokeWidth={1.6} aria-hidden="true" />
                  <h3 className="mt-4 text-[14.5px] font-semibold text-ink">{feature.title}</h3>
                  <p className="mt-2 text-[12.5px] leading-6 text-slate">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="page-container py-20 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div className="order-2 lg:order-1">
              <p className="overline">For the recipient</p>
              <h2 className="mt-3 font-serif text-[34px] leading-[1.15] tracking-[-0.01em] text-ink sm:text-[40px]">
                A signing page that asks only what it needs.
              </h2>
              <p className="mt-4 max-w-lg text-[14px] leading-7 text-slate">
                Recipients see the document, a short consent statement and their own highlighted
                fields. They can type, draw or upload a signature, review everything and download
                the completed PDF when the request is done.
              </p>
              <ul className="mt-7 space-y-4">
                {[
                  "Explicit consent to electronic signing before any field is editable.",
                  "Required-field validation in the browser and on the server.",
                  "Reminders rotate the signing token; voiding revokes every outstanding link.",
                  "A signed copy and audit certificate available to the sender when complete.",
                ].map((item) => (
                  <li key={item} className="flex gap-3 text-[13px] leading-6 text-ink-secondary">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-text" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="order-1 lg:order-2">
              <div className="rounded-card border border-hairline bg-surface p-6 shadow-float sm:p-8">
                <p className="text-[10.5px] font-semibold uppercase tracking-overline text-slate">
                  Electronic signature request
                </p>
                <h3 className="mt-2 font-serif text-[26px] leading-8 text-ink">
                  Consulting agreement — October
                </h3>
                <p className="mt-1.5 text-[12px] text-slate">
                  Sent by <span className="font-medium text-ink-secondary">Daniel Okafor</span> · Hart
                  & Co.
                </p>
                <div className="mt-5 rounded border border-hairline bg-surface-subtle/60 p-4">
                  <p className="text-[11.5px] font-semibold text-ink">Consent to electronic signatures</p>
                  <p className="mt-1.5 text-[11.5px] leading-5 text-slate">
                    By continuing, you agree to sign this document electronically and to receive
                    related records electronically.
                  </p>
                  <div className="mt-3 flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-sm border border-ink bg-ink">
                      <Check className="h-3 w-3 text-white" aria-hidden="true" />
                    </span>
                    <span className="text-[11.5px] leading-5 text-ink-secondary">
                      I agree to conduct this transaction electronically.
                    </span>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4">
                  <span className="text-[11.5px] text-slate">3 required fields</span>
                  <span className="inline-flex items-center gap-1.5 rounded bg-ink px-4 py-2 text-[12px] font-medium text-white">
                    Accept and continue
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-4 flex items-start gap-1.5 text-[10px] leading-4 text-slate">
                  <Lock className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
                  Private, single-recipient link. Do not forward it.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="scroll-mt-24 border-y border-hairline bg-ink py-20 text-white sm:py-24">
          <div className="page-container grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] lg:gap-20">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-overline text-gold">
                Security & evidence
              </p>
              <h2 className="mt-3 font-serif text-[34px] leading-[1.15] tracking-[-0.01em] sm:text-[42px]">
                Records you can inspect, not just trust.
              </h2>
              <p className="mt-4 max-w-lg text-[13.5px] leading-7 text-white/65">
                Documents live in private storage and are streamed only through permission-checked
                routes. Signing tokens are random, stored as hashes and scoped to one recipient.
                Every material action is appended to a hash chain — if any entry changes, the chain
                no longer verifies.
              </p>
              <p className="mt-6 max-w-lg border-l-2 border-gold/60 pl-4 text-[11.5px] leading-6 text-white/50">
                SignFlow provides an evidentiary record and workflow tooling. Legal requirements for
                electronic signatures vary by jurisdiction and document type; this product is not a
                substitute for legal advice.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Lock,
                  title: "Private by default",
                  body: "No public buckets or guessable document URLs. Short-lived, authorized streams only.",
                },
                {
                  icon: Fingerprint,
                  title: "Scoped signing tokens",
                  body: "32-byte tokens, SHA-256 hashed at rest, rotated on reminder and revoked on void.",
                },
                {
                  icon: ShieldCheck,
                  title: "Hash-chained audit",
                  body: "Each event commits to the previous entry. Verification is exposed in the document audit view.",
                },
                {
                  icon: Users,
                  title: "Tenant isolation",
                  body: "Every query is scoped to the active workspace, with role checks on the server.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-card border border-white/10 bg-white/[0.03] p-5">
                  <item.icon className="h-5 w-5 text-gold" strokeWidth={1.6} aria-hidden="true" />
                  <h3 className="mt-4 text-[13px] font-semibold text-white">{item.title}</h3>
                  <p className="mt-1.5 text-[11.5px] leading-5 text-white/55">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="page-container scroll-mt-24 py-20 sm:py-24">
          <div className="mx-auto max-w-xl text-center">
            <p className="overline">Pricing</p>
            <h2 className="mt-3 font-serif text-[34px] leading-[1.15] tracking-[-0.01em] text-ink sm:text-[42px]">
              Start free. Grow when you need to.
            </h2>
            <p className="mt-4 text-[13.5px] leading-6 text-slate">
              Every plan includes the complete signing flow, audit trail and private document
              storage. Limits apply to volume and team size.
            </p>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {Object.values(PLANS).map((plan) => {
              const featured = plan.id === "pro";
              return (
                <div
                  key={plan.id}
                  className={
                    featured
                      ? "relative flex flex-col rounded-card border border-ink bg-surface p-6 shadow-float sm:p-7"
                      : "relative flex flex-col rounded-card border border-hairline bg-surface p-6 sm:p-7"
                  }
                >
                  {featured ? (
                    <span className="absolute -top-3 left-6 rounded-pill bg-gold px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Most chosen
                    </span>
                  ) : null}
                  <h3 className="text-[14px] font-semibold text-ink">{plan.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="font-serif text-[38px] leading-none text-ink">
                      ${plan.priceMonthly}
                    </span>
                    <span className="text-[12px] text-slate">/ month</span>
                  </div>
                  <p className="mt-3 min-h-[48px] text-[12px] leading-6 text-slate">{plan.blurb}</p>
                  <ul className="mt-5 flex-1 space-y-3 border-t border-hairline pt-5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2.5 text-[12px] leading-5 text-ink-secondary">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-text" aria-hidden="true" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/auth/register"
                    className={buttonStyles(featured ? "primary" : "secondary", "md", "mt-7 w-full")}
                  >
                    {plan.priceMonthly === 0 ? "Start free" : `Choose ${plan.name}`}
                  </Link>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-center text-[11px] text-slate">
            Plans are activated instantly in this deployment. No card details are required.
          </p>
        </section>

        <section className="border-y border-hairline bg-surface py-20 sm:py-24">
          <div className="page-container grid gap-12 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)] lg:gap-20">
            <div>
              <p className="overline">Questions</p>
              <h2 className="mt-3 font-serif text-[34px] leading-[1.15] tracking-[-0.01em] text-ink sm:text-[40px]">
                Good to know before you send.
              </h2>
              <p className="mt-4 max-w-sm text-[13px] leading-6 text-slate">
                Still unsure? Create a free workspace and walk a sample document through the full
                flow. You can delete drafts at any time.
              </p>
            </div>
            <div className="divide-y divide-hairline border-y border-hairline">
              {faqs.map((faq) => (
                <details key={faq.question} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hairline text-slate transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl pr-10 text-[12.5px] leading-6 text-slate">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="page-container py-20 sm:py-24">
          <div className="rounded-card border border-hairline bg-surface px-6 py-12 text-center sm:px-12 sm:py-16">
            <p className="overline">Ready when you are</p>
            <h2 className="mx-auto mt-3 max-w-xl font-serif text-[36px] leading-[1.12] tracking-[-0.01em] text-ink sm:text-[46px]">
              Send your next agreement with a clear record.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[13.5px] leading-6 text-slate">
              Create a workspace, upload a PDF and send your first document in minutes. No card,
              no setup call, no account needed for recipients.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/auth/register" className={buttonStyles("primary", "lg")}>
                Create your workspace
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/auth/login" className={buttonStyles("secondary", "lg")}>
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline bg-surface">
        <div className="page-container py-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xs">
              <Logo />
              <p className="mt-3 text-[12px] leading-6 text-slate">
                A considered electronic signature workspace for professionals and teams.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-6 sm:grid-cols-3">
              <div>
                <p className="overline">Product</p>
                <ul className="mt-3 space-y-2 text-[12px] text-slate">
                  <li><a href="#how-it-works" className="hover:text-ink">How it works</a></li>
                  <li><a href="#platform" className="hover:text-ink">Platform</a></li>
                  <li><a href="#pricing" className="hover:text-ink">Pricing</a></li>
                </ul>
              </div>
              <div>
                <p className="overline">Account</p>
                <ul className="mt-3 space-y-2 text-[12px] text-slate">
                  <li><Link href="/auth/register" className="hover:text-ink">Create account</Link></li>
                  <li><Link href="/auth/login" className="hover:text-ink">Sign in</Link></li>
                  <li><Link href="/auth/forgot" className="hover:text-ink">Reset password</Link></li>
                </ul>
              </div>
              <div>
                <p className="overline">Trust</p>
                <ul className="mt-3 space-y-2 text-[12px] text-slate">
                  <li><a href="#security" className="hover:text-ink">Security</a></li>
                  <li><a href="#pricing" className="hover:text-ink">Plans</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-3 border-t border-hairline pt-6 text-[11px] leading-5 text-slate sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} SignFlow. All rights reserved.</p>
            <p className="max-w-xl sm:text-right">
              SignFlow is not a law firm and does not provide legal advice. Electronic signature
              requirements vary by jurisdiction.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
