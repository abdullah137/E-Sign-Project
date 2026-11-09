import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CircleDashed, Clock3 } from "lucide-react";
import { MarketingPageHeader } from "@/components/marketing/page-header";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "Practical guides for tenant inquiries, landlord review, tenancy agreements, signing securely, reading the audit trail and understanding Juripass plans.",
};

const roadmap = [
  {
    title: "Self-serve checkout",
    body: "Paid plan requests are recorded in Billing today. Card checkout and automatic activation are not implemented.",
  },
  {
    title: "API document sends",
    body: "The REST API is read-only. The 50 and 250 monthly send allowances on Starter and Team are catalogued but not active.",
  },
  {
    title: "Bulk send",
    body: "Preparing many recipients in one operation is planned. Each send must still create an isolated request and evidence record.",
  },
  {
    title: "SMS delivery",
    body: "Email is the available delivery channel. SMS is listed on paid plans but is not connected to a provider.",
  },
  {
    title: "AI contract review",
    body: "The two free reviews on the Free plan and unlimited reviews on paid plans are catalogued, not implemented.",
  },
  {
    title: "Webhooks and OAuth apps",
    body: "Event subscriptions and third-party app authorization are planned for a future API version.",
  },
  {
    title: "Automatic retention deletion",
    body: "Free retention is enforced as an access limit. Automated deletion after the window is not yet implemented.",
  },
];

export default function ResourcesPage() {
  return (
    <>
      <MarketingPageHeader
        eyebrow="Resources"
        title="Practical guides for a cleaner tenancy process."
        description="How to collect an inquiry, bring a landlord to a decision without an account, prepare an agreement, place fields precisely and read the evidence record that comes out the other side."
      />

      <div className="mx-auto grid w-full max-w-[1200px] gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:gap-16">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <p className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-brand-muted">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            Guides
          </p>
          <nav aria-label="Resource guides" className="mt-3 space-y-2 text-[12.5px]">
            {[
              ["Tenant inquiries", "#inquiries"],
              ["Landlord review", "#landlord-review"],
              ["Preparing an agreement", "#preparing"],
              ["Placing fields", "#fields"],
              ["Signing a document", "#signing"],
              ["Reading the audit trail", "#audit-trail"],
              ["Email delivery", "#email-delivery"],
              ["Plans and limits", "#plans"],
              ["Roadmap", "#roadmap"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="block text-brand-muted transition-colors hover:text-brand-ink"
              >
                {label}
              </a>
            ))}
          </nav>
          <Link
            href="/help"
            className="mt-6 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 hover:underline"
          >
            Help centre
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </aside>

        <article className="min-w-0 space-y-12">
          <section id="inquiries" className="scroll-mt-28">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-600">
              Guide 01
            </p>
            <h2 className="mt-2 text-[25px] font-semibold tracking-[-0.015em] text-brand-ink">
              Collecting a tenant inquiry
            </h2>
            <div className="mt-4 space-y-3 text-[13px] leading-7 text-brand-muted">
              <p>
                From a property page, send a private inquiry link to the applicant. The form asks
                for household, employment, estimated income ranges and up to two guarantor contacts.
                If the property has an inquiry fee, the applicant pays it by card on submission before
                the inquiry reaches your review queue.
              </p>
              <p>
                Income and household details are self-reported. The form states this plainly and
                asks applicants to confirm that deliberately false information may lead to a
                declined application. Juripass does not verify employment, income or identity
                automatically; treat the inquiry as a structured starting point for your own checks.
              </p>
              <p>
                The link is a high-entropy token stored hashed on the server. It expires and can be
                reissued, and it exposes only that applicant&apos;s form — never the workspace, other
                properties or other inquiries.
              </p>
            </div>
          </section>

          <section id="landlord-review" className="scroll-mt-28">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-600">
              Guide 02
            </p>
            <h2 className="mt-2 text-[25px] font-semibold tracking-[-0.015em] text-brand-ink">
              Bringing the landlord to a decision
            </h2>
            <div className="mt-4 space-y-3 text-[13px] leading-7 text-brand-muted">
              <p>
                Review the submitted inquiry first. Approving or declining it is your decision, and
                only an approved inquiry can be forwarded. Forwarding sends the landlord a separate
                private link with a summary of the application.
              </p>
              <p>
                The landlord does not need an account. The page shows the applicant details, the
                property and a downloadable summary PDF, and records an approve or decline decision
                with an optional comment. Declining requires a comment so the applicant has context.
              </p>
              <p>
                Neither a lawyer approval nor a landlord approval creates a tenancy. The agreement
                is prepared as the next step, and the record of each decision stays in the inquiry
                timeline.
              </p>
            </div>
          </section>

          <section id="preparing" className="scroll-mt-28">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-600">
              Guide 03
            </p>
            <h2 className="mt-2 text-[25px] font-semibold tracking-[-0.015em] text-brand-ink">
              Preparing an agreement for signature
            </h2>
            <div className="mt-4 space-y-3 text-[13px] leading-7 text-brand-muted">
              <p>
                Juripass accepts PDF files up to {env.maxUploadMb} MB and{" "}
                {env.maxPdfPages} pages in this deployment. The original file is stored unchanged;
                signed values are applied to a new copy during finalization. Generated agreements
                from the precedent library follow the same pipeline.
              </p>
              <p>
                Precedents are working drafts, not legal advice. Review the clauses, fill anything
                the generator cannot infer, and have qualified counsel adapt the text for your
                jurisdiction before relying on it.
              </p>
              <p>
                Flatten layers, embed fonts and remove form fields that should not be filled twice.
                A clean, text-based PDF gives signers a predictable page size and keeps field
                placement stable. Scanned pages are supported, but they are treated as flat images.
              </p>
              <p>
                If a page is rotated in the PDF, Juripass accounts for rotation when converting
                field geometry. Place a test field near a visible landmark and use the prepare
                preview to confirm alignment before sending.
              </p>
            </div>
          </section>

          <section id="fields" className="scroll-mt-28">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-600">
              Guide 04
            </p>
            <h2 className="mt-2 text-[25px] font-semibold tracking-[-0.015em] text-brand-ink">
              Placing fields that stay in place
            </h2>
            <div className="mt-4 space-y-3 text-[13px] leading-7 text-brand-muted">
              <p>
                Fields are stored as normalized coordinates relative to each page, not as pixels in
                the browser. That means zoom, window size and device pixel ratio do not change where
                a signature lands when the final PDF is produced.
              </p>
              <p>
                Drag a field to move it and use the resize handles for its bounds. Keyboard nudging
                moves the focused field by a small increment; hold Shift for a larger step. Each
                field can be assigned to a recipient and marked required.
              </p>
              <p>
                A document can only be sent when every recipient has at least one field and no
                required field is missing. The same rule is checked again on the server, so a
                modified browser cannot bypass it.
              </p>
            </div>
          </section>

          <section id="signing" className="scroll-mt-28">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-600">
              Guide 05
            </p>
            <h2 className="mt-2 text-[25px] font-semibold tracking-[-0.015em] text-brand-ink">
              Signing a document you received
            </h2>
            <div className="mt-4 space-y-3 text-[13px] leading-7 text-brand-muted">
              <p>
                Open the link from your invitation email. No account is required. You will see the
                document, a short explanation of electronic signing, and only the fields assigned to
                you — other recipients&apos; fields are not shown.
              </p>
              <p>
                Accept the consent statement to unlock the fields. Signatures can be typed, drawn or
                uploaded; initials and date fields behave the same way. Required fields must be
                valid before you can complete, and you can review the document before submitting.
              </p>
              <p>
                If something is wrong, decline with a reason instead of signing. Signing links expire
                with the request and are revoked when a document is voided. Do not forward your link:
                it is scoped to you and may reveal the document to someone else.
              </p>
            </div>
          </section>

          <section id="audit-trail" className="scroll-mt-28">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-600">
              Guide 06
            </p>
            <h2 className="mt-2 text-[25px] font-semibold tracking-[-0.015em] text-brand-ink">
              Reading the audit trail
            </h2>
            <div className="mt-4 space-y-3 text-[13px] leading-7 text-brand-muted">
              <p>
                Every material action is an audit event with a unique ID, the document and workspace
                it belongs to, the event type, the actor and recipient where relevant, and the time
                it occurred on the server in UTC. Events are written inside the same transaction as
                the state change they describe.
              </p>
              <p>
                Each document has its own monotonic sequence. Events are ordered by sequence, then
                timestamp, so two events in the same millisecond still have a deterministic order.
                The audit view displays times in your local timezone with the UTC value available on
                hover; the stored record never depends on your device clock.
              </p>
              <p>
                Occurred time, processing time and delivery time are kept separate. An invitation,
                for example, can be created, processed by the mail provider and delivered later. A
                failed delivery is recorded as failed, not as if it never happened, and can be
                retried from the developer settings.
              </p>
              <p>
                Each new event commits to the previous event with SHA-256. The verification view
                recalculates the chain and reports whether it matches. The completed PDF also has its
                own digest, recorded when finalization finishes.
              </p>
            </div>
          </section>

          <section id="email-delivery" className="scroll-mt-28">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-600">
              Guide 07
            </p>
            <h2 className="mt-2 text-[25px] font-semibold tracking-[-0.015em] text-brand-ink">
              Email delivery and retries
            </h2>
            <div className="mt-4 space-y-3 text-[13px] leading-7 text-brand-muted">
              <p>
                Invitations, reminders, verification codes and completion notices are queued as
                outbox records. Each record tracks attempts, the last error, the next retry time and
                the provider message ID when delivery succeeds.
              </p>
              <p>
                Failed messages are retried automatically with a delay between attempts. Signed-in
                workspace admins can also retry a failed message from Settings → Developers. A retry
                does not create a second signing token; duplicate sends are suppressed by the
                outbox record.
              </p>
              <p>
                Without an SMTP provider, this deployment writes messages to the local development
                outbox instead of sending them. Links there are real and fully functional for local
                testing.
              </p>
            </div>
          </section>

          <section id="plans" className="scroll-mt-28">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-600">
              Guide 08
            </p>
            <h2 className="mt-2 text-[25px] font-semibold tracking-[-0.015em] text-brand-ink">
              Plans and limits
            </h2>
            <div className="mt-4 space-y-3 text-[13px] leading-7 text-brand-muted">
              <p>
                Free includes unlimited inquiries, properties, documents and recipients, one active
                template, a 14-day retention window, email notifications and the complete signing
                and audit flow. It has no API access and no public signing links.
              </p>
              <p>
                Starter adds three seats, unlimited templates, custom messages, custom branding,
                public signing links and shared visibility. Team adds unlimited seats and
                centralized billing. Entitlements are defined once in the plan catalogue and enforced
                on the server for sends, templates, seats, branding, public links, API keys and
                retention.
              </p>
              <p>
                Features marked &ldquo;Soon&rdquo; on the pricing page — API document sends, SMS
                delivery, open notifications, bulk send and AI contract review — are catalogue entries
                for future work, not working features.
              </p>
              <Link
                href="/#pricing"
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 hover:underline"
              >
                Compare plans
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </section>

          <section id="roadmap" className="scroll-mt-28">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-600">
              <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />
              Roadmap
            </p>
            <h2 className="mt-2 text-[25px] font-semibold tracking-[-0.015em] text-brand-ink">
              What is not in this deployment
            </h2>
            <p className="mt-3 text-[13px] leading-7 text-brand-muted">
              These items are planned and are not functional today. They are listed here so the
              pricing page and product never imply otherwise.
            </p>
            <ul className="mt-5 divide-y divide-brand-line rounded-card border border-brand-line bg-white">
              {roadmap.map((item) => (
                <li key={item.title} className="flex gap-4 px-5 py-4">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-brand-ink">
                      {item.title}
                      <span className="rounded-sm bg-brand-50 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.05em] text-brand-700">
                        Planned
                      </span>
                    </p>
                    <p className="mt-1 text-[12px] leading-5 text-brand-muted">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <p className="border-t border-brand-line pt-6 text-[11.5px] leading-6 text-brand-muted">
            Juripass provides workflow and evidence tooling, not legal advice. Precedents are
            working drafts, and electronic-signature requirements vary by jurisdiction, industry
            and document type.
          </p>
        </article>
      </div>
    </>
  );
}
