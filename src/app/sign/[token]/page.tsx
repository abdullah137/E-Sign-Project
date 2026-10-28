import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Clock3, ShieldOff } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { SigningExperience, type SigningValue } from "@/components/signing/signing-experience";
import { getDb } from "@/lib/db";
import { getSigningContext, type SigningLookup } from "@/lib/documents";
import type { FieldType } from "@/lib/field-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review and sign",
  robots: { index: false, follow: false, nocache: true },
};

const INVALID_COPY: Record<
  Extract<SigningLookup, { ok: false }>["reason"],
  { title: string; body: string; icon: "clock" | "shield" | "alert" }
> = {
  not_found: {
    title: "This link is not recognised",
    body: "The signing link may have been mistyped or replaced by a newer invitation. Check the most recent email from the sender, or ask them to resend the request.",
    icon: "alert",
  },
  expired: {
    title: "This request has expired",
    body: "Signing links are valid for a limited time. Ask the sender to resend the request so you can receive a fresh link.",
    icon: "clock",
  },
  voided: {
    title: "This request was withdrawn",
    body: "The sender has voided this signature request, so it can no longer be signed. Contact them if you believe this was a mistake.",
    icon: "shield",
  },
  declined: {
    title: "You declined this request",
    body: "This request was declined and its signing links are now inactive. Contact the sender if you would like them to send a new copy.",
    icon: "shield",
  },
  revoked: {
    title: "This link is no longer active",
    body: "Access to this document was revoked by the sender or has expired. Ask the sender to issue a new signing link.",
    icon: "shield",
  },
};

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lookup = getSigningContext(getDb(), token);

  if (!lookup.ok) {
    return <InvalidLinkScreen reason={lookup.reason} documentTitle={lookup.documentTitle} />;
  }

  const { context } = lookup;
  const values: SigningValue[] = context.values.map((value) => ({
    fieldId: value.field_id,
    valueText: value.value_text,
    checked: value.checked === 1,
    signatureAssetId: value.signature_asset_id,
    signatureMode: value.signature_mode,
  }));

  return (
    <SigningExperience
      token={token}
      documentTitle={context.document.title}
      senderName={context.senderName}
      workspaceName={context.workspace.brand_display_name || context.workspace.name}
      workspaceColor={context.workspace.brand_color}
      recipientName={context.recipient.name}
      recipientEmail={context.recipient.email}
      message={context.document.message}
      status={context.recipient.status}
      viewState={context.viewState}
      signedAt={context.recipient.signed_at}
      expiresAt={context.document.expires_at}
      fields={context.fields.map((field) => ({
        id: field.id,
        pageIndex: field.page_index,
        type: field.type as FieldType,
        label: field.label,
        required: field.required === 1,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
      }))}
      values={values}
    />
  );
}

function InvalidLinkScreen({
  reason,
  documentTitle,
}: {
  reason: Extract<SigningLookup, { ok: false }>["reason"];
  documentTitle?: string;
}) {
  const copy = INVALID_COPY[reason];
  const Icon = copy.icon === "clock" ? Clock3 : copy.icon === "shield" ? ShieldOff : AlertTriangle;
  const tone =
    copy.icon === "clock"
      ? "bg-warning-bg text-gold-text"
      : copy.icon === "shield"
        ? "bg-surface-muted text-slate"
        : "bg-[#FBEAEA] text-danger";

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-hairline bg-[rgba(248,249,250,0.94)]">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3 sm:px-6">
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
          {documentTitle ? (
            <p className="mt-1 text-[12.5px] font-medium text-ink-secondary">{documentTitle}</p>
          ) : null}
          <p className="mx-auto mt-3 max-w-md text-[13px] leading-6 text-slate">{copy.body}</p>
          <p className="mt-7 border-t border-hairline pt-5 text-[11px] leading-5 text-placeholder">
            For your security, this page does not reveal the contents of the document. Only the
            intended recipient can open it through a valid signing link.
          </p>
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
