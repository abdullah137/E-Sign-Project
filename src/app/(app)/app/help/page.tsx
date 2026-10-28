import type { Metadata } from "next";
import Link from "next/link";
import {
  FilePlus2,
  Files,
  KeyRound,
  LayoutTemplate,
  LifeBuoy,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Help" };
export const dynamic = "force-dynamic";

const guides = [
  {
    icon: FilePlus2,
    title: "Send your first document",
    body: "Upload a PDF, place fields for each recipient and send. Drafts autosave as you edit.",
    href: "/app/documents/new",
    action: "New document",
  },
  {
    icon: Files,
    title: "Track every envelope",
    body: "Filter by status, search recipients and open the audit trail for any document.",
    href: "/app/documents",
    action: "All documents",
  },
  {
    icon: LayoutTemplate,
    title: "Reuse a layout",
    body: "Save a prepared document as a template, then create a copy whenever you need it.",
    href: "/app/templates",
    action: "Open templates",
  },
  {
    icon: Users,
    title: "Invite your team",
    body: "Owners and admins can invite colleagues, assign roles and manage seats.",
    href: "/app/settings/team",
    action: "Manage team",
  },
];

const faqs = [
  {
    question: "Do recipients need an account?",
    answer:
      "No. Each recipient receives a private signing link. Opening it shows the document, the e-signature consent and only the fields assigned to that recipient. Access is controlled by a high-entropy token that is stored hashed on the server.",
  },
  {
    question: "What happens when everyone has signed?",
    answer:
      "The document enters a finalizing state, signed field values are stamped into a new PDF, and an audit certificate is appended. The completed PDF and certificate are then available to download from the document page. The original upload is never modified.",
  },
  {
    question: "How do I know the audit trail was not altered?",
    answer:
      "Every audit event is linked to the previous event with a SHA-256 hash. The document page recalculates the chain and reports whether it verifies. The completion certificate records the final document hash so a downloaded file can be compared against the record.",
  },
  {
    question: "Can I cancel a document after sending?",
    answer:
      "Yes. A pending document can be voided by an owner or admin. Voiding revokes every outstanding signing link and is recorded in the audit trail. Recipients who open an old link see an explanation that the document is no longer available.",
  },
  {
    question: "Are these signatures legally binding?",
    answer:
      "SignFlow records intent, identity signals and a tamper-evident audit trail, but legal effect depends on the jurisdiction, the document type and your signing policy. Obtain local legal review before relying on electronic signatures for a particular agreement; this deployment does not claim universal legal compliance.",
  },
  {
    question: "Where do emails go in this deployment?",
    answer: env.showDevOutbox
      ? "No SMTP provider is configured, so transactional email is captured in the local development outbox. Verification, invitation and signing links there are real and fully functional."
      : "This deployment is configured without a development outbox. If an email does not arrive, ask a workspace admin to regenerate the signing link from the document page.",
  },
  {
    question: "Which plan limits apply?",
    answer:
      "Each plan sets a monthly document allowance, recipients per document and team seats. The billing page shows current usage. Uploading or sending beyond a limit is blocked by the server, not just hidden in the interface.",
  },
];

export default function HelpPage() {
  return (
    <div className="page-container py-8 sm:py-10">
      <PageHeader
        overline="Support"
        title="Help"
        description="A short guide to sending, signing and proving what happened. Everything below reflects the behaviour of this deployment."
      />

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold text-ink">Start here</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {guides.map((guide) => {
            const Icon = guide.icon;
            return (
              <Link
                key={guide.title}
                href={guide.href}
                className="group flex gap-4 rounded-card border border-hairline bg-surface p-5 transition-colors hover:border-[rgba(18,20,23,0.2)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-slate">
                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink">{guide.title}</span>
                  <span className="mt-1 block text-[12px] leading-5 text-slate">{guide.body}</span>
                  <span className="mt-2 block text-[12px] font-medium text-gold-text group-hover:underline">
                    {guide.action}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-[15px] font-semibold text-ink">Frequently asked</h2>
        <div className="mt-4 divide-y divide-hairline rounded-card border border-hairline bg-surface">
          {faqs.map((faq) => (
            <details key={faq.question} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[13.5px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                {faq.question}
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hairline text-slate transition-transform group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-3xl pr-8 text-[12.5px] leading-6 text-slate">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-hairline bg-surface p-5">
          <div className="flex items-center gap-2 text-ink">
            <ShieldCheck className="h-4 w-4 text-gold-text" aria-hidden="true" />
            <h2 className="text-[13.5px] font-semibold">Privacy and access</h2>
          </div>
          <p className="mt-2 text-[12px] leading-5 text-slate">
            Documents are scoped to a single workspace and served through authenticated routes.
            Signing links are unguessable, expire with the document, and can be revoked by resending
            or voiding. Storage paths, API keys and signing tokens are never shown to other tenants.
          </p>
          <Link
            href="/app/settings/developers"
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-gold-text hover:underline"
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            API keys and access
          </Link>
        </div>

        <div className="rounded-card border border-hairline bg-surface p-5">
          <div className="flex items-center gap-2 text-ink">
            <LifeBuoy className="h-4 w-4 text-gold-text" aria-hidden="true" />
            <h2 className="text-[13.5px] font-semibold">Still stuck?</h2>
          </div>
          <p className="mt-2 text-[12px] leading-5 text-slate">
            This is a demonstration deployment, so no support desk is staffed. Use the{" "}
            <Link href="/app/settings/team" className="text-ink underline underline-offset-2">
              team page
            </Link>{" "}
            to find your workspace owner
            {env.showDevOutbox ? (
              <>
                , or inspect{" "}
                <Link href="/dev/outbox" className="text-ink underline underline-offset-2">
                  captured email
                </Link>{" "}
                for verification and signing links
              </>
            ) : null}
            .
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-slate">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            support@signflow.test (not monitored)
          </p>
        </div>
      </section>

      <p className="mt-8 border-t border-hairline pt-5 text-[11.5px] leading-5 text-slate">
        SignFlow provides workflow and evidence tooling, not legal advice. Electronic signature
        requirements differ by jurisdiction and document type; validate suitability with counsel
        before using a signed record in a legal proceeding.
      </p>
    </div>
  );
}
