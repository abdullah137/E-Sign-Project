import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Clock3, Link2Off } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { PublicLinkExperience } from "@/components/public-links/public-link-experience";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { getPublicLinkContext, type PublicLinkLookup } from "@/lib/templates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Request a document",
  robots: { index: false, follow: false, nocache: true },
};

const INVALID_COPY: Record<
  Extract<PublicLinkLookup, { ok: false }>["reason"],
  { title: string; body: string; icon: "clock" | "link" | "alert" }
> = {
  invalid: {
    title: "This link is not recognised",
    body: "The address may be incomplete or mistyped. Ask the sender for the original link.",
    icon: "alert",
  },
  revoked: {
    title: "This link was withdrawn",
    body: "The sender has revoked this public link. Contact them if you still need this document.",
    icon: "link",
  },
  expired: {
    title: "This link has expired",
    body: "Public links are valid for a limited time. Ask the sender to publish a fresh link.",
    icon: "clock",
  },
  unavailable: {
    title: "This document is not available",
    body: "The underlying template is no longer active, so new requests cannot be accepted.",
    icon: "link",
  },
};

export default async function PublicLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const lookup = getPublicLinkContext(db, token);

  if (!lookup.ok) {
    return <InvalidPublicLink reason={lookup.reason} />;
  }

  const workspaceName = lookup.workspace.brand_display_name || lookup.workspace.name;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-hairline bg-[rgba(248,249,250,0.94)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Logo href="/" />
          <span className="text-[11px] uppercase tracking-overline text-slate">Secure request</span>
        </div>
      </header>
      <main className="mx-auto flex w-full flex-1 items-start justify-center px-4 py-10 sm:px-6 sm:py-16">
        <PublicLinkExperience
          token={token}
          workspaceName={workspaceName}
          workspaceColor={lookup.workspace.brand_color}
          templateName={lookup.template.name}
          templateDescription={lookup.template.description}
          pageCount={lookup.template.page_count}
          fieldCount={lookup.fieldCount}
          expiresAt={lookup.link.expires_at}
          showDevOutbox={env.showDevOutbox}
        />
      </main>
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-[11px] text-slate sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Powered by SignFlow. Electronic signature records include a tamper-evident audit trail.</p>
          <Link href="/" className="hover:text-ink hover:underline">
            About SignFlow
          </Link>
        </div>
      </footer>
    </div>
  );
}

function InvalidPublicLink({
  reason,
}: {
  reason: Extract<PublicLinkLookup, { ok: false }>["reason"];
}) {
  const copy = INVALID_COPY[reason];
  const Icon = copy.icon === "clock" ? Clock3 : copy.icon === "link" ? Link2Off : AlertTriangle;
  const tone =
    copy.icon === "clock"
      ? "bg-warning-bg text-gold-text"
      : copy.icon === "link"
        ? "bg-surface-muted text-slate"
        : "bg-[#FBEAEA] text-danger";

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-hairline bg-surface">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-4 sm:px-6">
          <Logo href="/" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
        <div className="rounded-card border border-hairline bg-surface p-7 text-center sm:p-10">
          <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${tone}`}>
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-serif text-[30px] leading-9 text-ink sm:text-[34px]">
            {copy.title}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[13px] leading-6 text-slate">{copy.body}</p>
        </div>
        <p className="mt-6 text-center text-[12px] text-slate">
          <Link href="/" className="font-medium text-gold-text underline-offset-2 hover:underline">
            Learn about SignFlow
          </Link>
        </p>
      </main>
    </div>
  );
}
