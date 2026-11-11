import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  ClipboardList,
  FileSignature,
  LifeBuoy,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { MarketingPageHeader } from "@/components/marketing/page-header";
import { FaqAccordion } from "@/components/marketing/faq-accordion";

export const metadata: Metadata = {
  title: "Help centre",
  description:
    "Guides for tenant inquiries, landlord review, tenancy agreements and signing in Juripass, plus answers about plans, email delivery and evidence.",
};

const guides = [
  {
    icon: ClipboardList,
    title: "Run your first inquiry",
    body: "Create a workspace, add a property and send an applicant a private inquiry link.",
    href: "/auth/register",
    action: "Create a workspace",
  },
  {
    icon: FileSignature,
    title: "Review a submitted inquiry",
    body: "Check the household, income ranges and guarantors, then approve or decline with a note.",
    href: "/resources#inquiries",
    action: "Read the inquiry guide",
  },
  {
    icon: Building2,
    title: "Forward to the landlord",
    body: "Send an approved application to the landlord with a private approve-or-decline link.",
    href: "/resources#landlord-review",
    action: "Read the landlord guide",
  },
  {
    icon: BookOpen,
    title: "Prepare an agreement",
    body: "Choose a precedent, review the clauses and place signing fields before inviting signers.",
    href: "/resources#preparing",
    action: "Read the agreement guide",
  },
  {
    icon: UserPlus,
    title: "Sign a document you received",
    body: "Open your link, review the document, accept the signing consent and complete your fields.",
    href: "/resources#signing",
    action: "Read the signing guide",
  },
  {
    icon: ShieldCheck,
    title: "Understand the evidence trail",
    body: "See how events are sequenced, hash-chained and verified, and what the completed PDF digest represents.",
    href: "/resources#audit-trail",
    action: "Read about evidence",
  },
];

const faqs = [
  {
    question: "Do tenants and landlords need a Juripass account?",
    answer: (
      <p>
        No. A tenant completes the inquiry from a private link, and a landlord approves or declines
        from a separate expiring link. Both links are backed by high-entropy tokens stored hashed
        on the server, and neither role can browse the workspace, other properties or other
        applicants.
      </p>
    ),
  },
  {
    question: "Who reviews the tenant inquiry first?",
    answer: (
      <p>
        The lawyer or agency reviews every submitted inquiry before it can be forwarded. Only an
        approved inquiry gets a landlord link. The landlord then approves or declines with an
        optional comment. Neither decision creates a tenancy on its own.
      </p>
    ),
  },
  {
    question: "Does Juripass verify tenant information?",
    answer: (
      <p>
        Not automatically. Income, employment, identity and household details are self-reported,
        and applicants are told that deliberately false information may lead to a declined
        application. Documents the workspace asks for separately are stored privately and are
        not a substitute for your own verification process.
      </p>
    ),
  },
  {
    question: "How are agreements prepared and signed?",
    answer: (
      <p>
        After landlord approval, pick a precedent and the tenancy dates. Juripass generates a
        prefilled draft, adds signature and date fields, and opens it in the field editor. Signing
        is sequential: tenant first, then guarantor, then landlord. Later signers cannot open the
        document early, and finalization waits for every required signature.
      </p>
    ),
  },
  {
    question: "What happens when everyone has signed?",
    answer: (
      <p>
        The document enters a finalizing state. Signed values are stamped into a new PDF, the
        completed document is hashed and an audit certificate is appended. The completed PDF and
        certificate are then available to the sender and to recipients from their signing link.
      </p>
    ),
  },
  {
    question: "How do I know the audit trail has not been altered?",
    answer: (
      <p>
        Each event is written with a per-document sequence number and a SHA-256 hash that commits
        to the previous event. The document view recalculates the chain and reports whether it is
        intact. The audit certificate records the completed document digest so a downloaded file
        can be compared with the record.
      </p>
    ),
  },
  {
    question: "Can I cancel a request after sending it?",
    answer: (
      <p>
        A pending document can be voided by an owner or admin. Voiding revokes every outstanding
        signing link and records the action in the audit trail. Recipients who open an old link see
        that the document is no longer available. A recipient can also decline, which ends their
        participation without marking the document complete.
      </p>
    ),
  },
  {
    question: "Which plan limits apply?",
    answer: (
      <p>
        Free includes unlimited inquiries, properties, documents and recipients, one active
        template, a 14-day retention window and no API document sends. Starter adds three seats,
        unlimited templates, custom messages, branding, public signing links and a 50-send API
        allocation that is not yet implemented. Team adds unlimited seats, shared visibility,
        centralized billing and a 250-send allocation, also not yet implemented. Every limit is
        enforced on the server.
      </p>
    ),
  },
  {
    question: "How are payments recorded?",
    answer: (
      <p>
        Payments are recorded manually. A workspace user logs a charge with an amount and due date,
        then marks it paid with a method and note. There is no payment gateway or card processing in
        this deployment, so &ldquo;paid&rdquo; reflects an offline record, not a cleared transaction.
        Renewal reminders notify the tenant and landlord; they do not extend a term automatically.
      </p>
    ),
  },
  {
    question: "An email did not arrive. What should I do?",
    answer: (
      <p>
        Signed-in admins can open Settings → Developers to see delivery status, attempts and the
        last error for each message, and retry a failed message. If the outbox has no record, check
        the recipient address and resend the link from the inquiry or document page. A reminder
        rotates the signing token, so use the newest link.
      </p>
    ),
  },
];

export default function PublicHelpPage() {
  return (
    <>
      <MarketingPageHeader
        eyebrow="Support"
        title="Help centre"
        description="Short, accurate answers about inquiries, landlord decisions, agreements, signing and plans. Everything below reflects the behaviour of this deployment."
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/resources"
            className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-brand-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Browse guides
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex h-10 items-center rounded-md border border-hairline bg-card px-4 text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-50"
          >
            Sign in to your workspace
          </Link>
        </div>
      </MarketingPageHeader>

      <div className="mx-auto w-full max-w-[1200px] px-5 py-16 sm:px-8 sm:py-20">
        <section>
          <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-brand-ink">
            Start here
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((guide) => {
              const Icon = guide.icon;
              return (
                <Link
                  key={guide.title}
                  href={guide.href}
                  className="group flex flex-col rounded-card border border-brand-line bg-white p-6 transition-colors hover:border-brand-200 hover:bg-brand-wash"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded bg-brand-50 text-brand-600">
                    <Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <span className="mt-4 text-[14px] font-semibold text-brand-ink">
                    {guide.title}
                  </span>
                  <span className="mt-2 flex-1 text-[12.5px] leading-6 text-brand-muted">
                    {guide.body}
                  </span>
                  <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 group-hover:underline">
                    {guide.action}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-brand-ink">
              Frequently asked
            </h2>
            <p className="mt-3 max-w-sm text-[13px] leading-6 text-brand-muted">
              Still unsure? A free workspace is the quickest way to see the full flow with your own
              property and applicant details.
            </p>
          </div>
          <FaqAccordion items={faqs} />
        </section>

        <section className="mt-16 rounded-card border border-brand-line bg-brand-wash p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded bg-white text-brand-600 ring-1 ring-brand-line">
              <LifeBuoy className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-[14.5px] font-semibold text-brand-ink">
                Support in this deployment
              </h2>
              <p className="mt-1.5 max-w-2xl text-[12.5px] leading-6 text-brand-muted">
                This deployment does not operate a staffed support desk. Signed-in workspace owners
                and admins can review email delivery failures and retry messages in Settings →
                Developers, and follow plan requests in Billing. Account recovery is handled by the
                password-reset flow.
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-[12px] font-semibold text-brand-700">
                <Link href="/auth/login" className="hover:underline">
                  Sign in
                </Link>
                <Link href="/auth/forgot" className="hover:underline">
                  Reset password
                </Link>
                <Link href="/resources#roadmap" className="hover:underline">
                  What is still planned
                </Link>
              </div>
            </div>
          </div>
        </section>

        <p className="mt-10 border-t border-brand-line pt-6 text-[11.5px] leading-6 text-brand-muted">
          Juripass provides workflow and evidence tooling, not legal advice. Precedents are working
          drafts, and electronic-signature requirements differ by jurisdiction and document type;
          validate suitability with qualified counsel before relying on a signed record in a legal
          proceeding.
        </p>
      </div>
    </>
  );
}
