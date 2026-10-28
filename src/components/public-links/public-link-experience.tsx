"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, FileText, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/format";

export function PublicLinkExperience({
  token,
  workspaceName,
  workspaceColor,
  templateName,
  templateDescription,
  pageCount,
  fieldCount,
  expiresAt,
  showDevOutbox,
}: {
  token: string;
  workspaceName: string;
  workspaceColor: string | null;
  templateName: string;
  templateDescription: string | null;
  pageCount: number;
  fieldCount: number;
  expiresAt: string | null;
  showDevOutbox: boolean;
}) {
  const [step, setStep] = useState<"details" | "code" | "done">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);

  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/public/${encodeURIComponent(token)}/request`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setStep("code");
      setCode("");
      setNotice(`A six-digit code is on its way to ${email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The code could not be sent.");
    } finally {
      setSending(false);
    }
  };

  const resend = async () => {
    setSending(true);
    setError(null);
    try {
      await apiFetch(`/api/public/${encodeURIComponent(token)}/request`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setNotice("A new code was sent. The previous code no longer works.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The code could not be resent.");
    } finally {
      setSending(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setVerifying(true);
    setError(null);
    try {
      const result = await apiFetch<{ signingUrl: string }>(
        `/api/public/${encodeURIComponent(token)}/verify`,
        {
          method: "POST",
          body: JSON.stringify({ name, email, code }),
        },
      );
      setSigningUrl(result.signingUrl);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The code could not be verified.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="w-full max-w-lg">
      <div className="rounded-card border border-hairline bg-surface p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <span className="overline">Document request</span>
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-subtle px-2.5 py-1 text-[11px] font-medium text-slate">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Verified access
          </span>
        </div>
        <h1 className="mt-3 font-serif text-[30px] leading-9 text-ink">{templateName}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-slate">
          {workspaceColor ? (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: workspaceColor }}
              aria-hidden="true"
            />
          ) : null}
          Requested from {workspaceName}
        </p>
        {templateDescription ? (
          <p className="mt-3 text-[13px] leading-6 text-ink-secondary">{templateDescription}</p>
        ) : null}

        <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-hairline py-3">
          <div>
            <dt className="overline">Document</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 text-[12px] font-medium text-ink">
              <FileText className="h-3.5 w-3.5 text-slate" aria-hidden="true" />
              {pageCount} page{pageCount === 1 ? "" : "s"}
            </dd>
          </div>
          <div>
            <dt className="overline">Fields to complete</dt>
            <dd className="mt-0.5 text-[12px] font-medium text-ink">{fieldCount}</dd>
          </div>
        </dl>

        {step === "details" ? (
          <form onSubmit={requestCode} className="mt-6 space-y-4" noValidate>
            <div>
              <Label htmlFor="publicName" required>
                Full name
              </Label>
              <Input
                id="publicName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                maxLength={120}
                required
              />
            </div>
            <div>
              <Label htmlFor="publicEmail" required>
                Email address
              </Label>
              <Input
                id="publicEmail"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                maxLength={200}
                required
                aria-invalid={Boolean(error) || undefined}
              />
              <FieldError>{error}</FieldError>
              <p className="mt-1.5 text-[11.5px] leading-5 text-slate">
                We send a one-time code to confirm this address. Use the email where you want the
                signed copy.
              </p>
            </div>
            <Button type="submit" loading={sending} className="w-full">
              Send verification code
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <p className="text-center text-[11px] leading-5 text-slate">
              By continuing you agree to sign electronically and to receive a one-time code. You can
              decline on the signing page.
            </p>
          </form>
        ) : null}

        {step === "code" ? (
          <form onSubmit={verify} className="mt-6 space-y-4" noValidate>
            <div className="flex items-start gap-2.5 rounded border border-hairline bg-surface-subtle/60 px-3.5 py-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate" aria-hidden="true" />
              <div>
                <p className="text-[12px] leading-5 text-ink-secondary">
                  {notice ?? `Enter the code sent to ${email}.`}
                </p>
                {showDevOutbox ? (
                  <Link
                    href="/dev/outbox"
                    target="_blank"
                    className="mt-1 inline-block text-[11.5px] font-medium text-gold-text hover:underline"
                  >
                    Open development outbox
                  </Link>
                ) : null}
              </div>
            </div>
            <div>
              <Label htmlFor="publicCode" required>
                Six-digit code
              </Label>
              <Input
                id="publicCode"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="000000"
                className="h-12 text-center font-mono text-[20px] tracking-[0.4em]"
                autoFocus
                required
              />
              <FieldError>{error}</FieldError>
            </div>
            <Button type="submit" loading={verifying} className="w-full" disabled={code.length !== 6}>
              Verify and continue
            </Button>
            <div className="flex flex-col items-center gap-2 text-[11.5px] text-slate">
              <button
                type="button"
                onClick={resend}
                disabled={sending}
                className="font-medium text-gold-text underline-offset-2 hover:underline disabled:opacity-50"
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("details");
                  setError(null);
                  setNotice(null);
                }}
                className="hover:text-ink"
              >
                Use a different email
              </button>
            </div>
          </form>
        ) : null}

        {step === "done" ? (
          <div className="mt-6">
            <div className="flex items-start gap-3 rounded border border-[rgba(62,123,81,0.24)] bg-success-bg px-4 py-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-text" aria-hidden="true" />
              <div className="text-[12px] leading-5 text-success-text">
                <p className="font-semibold">Email verified</p>
                <p className="mt-0.5">
                  A signing invitation was created for {email}. Continue to review the document and add
                  your signature.
                </p>
              </div>
            </div>
            {signingUrl ? (
              <Link
                href={signingUrl}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-ink px-6 text-sm font-medium text-white transition-colors hover:bg-[#24282F]"
              >
                Review and sign
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : null}
            <p className="mt-3 text-center text-[11px] leading-5 text-slate">
              The link is also in your email. Only you can open it, and it expires with the request.
            </p>
          </div>
        ) : null}
      </div>
      <p className="mt-4 text-center text-[11px] leading-5 text-slate">
        {expiresAt ? `This request link expires ${formatDate(expiresAt)}. ` : ""}
        Your email is used only for this document request.
      </p>
    </div>
  );
}
