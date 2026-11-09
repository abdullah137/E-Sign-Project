import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { getDb } from "@/lib/db";
import { verifyInquiryPayment } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment status",
  robots: { index: false, follow: false, nocache: true },
};

type PaymentState = "paid" | "pending" | "failed";

const COPY: Record<PaymentState, { title: string; body: string }> = {
  paid: {
    title: "Payment received",
    body: "Your inquiry fee is confirmed. The lawyer can now review your application and you will receive email updates as it moves forward.",
  },
  pending: {
    title: "Payment not confirmed yet",
    body: "Paystack has not confirmed this payment. If you completed the payment, wait a moment and check again. Nothing else is required from you.",
  },
  failed: {
    title: "Payment was not completed",
    body: "Paystack reported that this payment did not go through. Return to your inquiry to try again or contact the workspace.",
  },
};

export default async function PaymentCallbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const reference =
    (typeof query.reference === "string" ? query.reference : null) ||
    (typeof query.trxref === "string" ? query.trxref : null) ||
    "";

  let state: PaymentState | null = null;
  let error: string | null = null;
  if (!reference) {
    error = "This page is missing the payment reference. Return to your inquiry to check the payment status.";
  } else {
    try {
      const result = await verifyInquiryPayment(getDb(), { rawToken: token, reference });
      if (result.paymentStatus === "paid") state = "paid";
      else if (result.paymentStatus === "failed") state = "failed";
      else if (result.paymentStatus === "not_required") state = "paid";
      else state = "pending";
    } catch (err) {
      error = err instanceof Error ? err.message : "The payment could not be verified.";
    }
  }

  const copy = state ? COPY[state] : null;
  const inquiryHref = `/inquiry/${encodeURIComponent(token)}`;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-hairline bg-card">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-4 sm:px-6">
          <Logo href="/" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
        <div className="rounded-card border border-hairline bg-surface p-7 text-center sm:p-10">
          <span
            className={
              state === "paid"
                ? "mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-success-text"
                : "mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-slate"
            }
          >
            {state === "paid" ? (
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            ) : state === "pending" ? (
              <Clock3 className="h-6 w-6" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            )}
          </span>
          <h1 className="mt-5 font-serif text-[30px] leading-9 text-ink sm:text-[34px]">
            {copy ? copy.title : "Payment status unavailable"}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[13px] leading-6 text-slate">
            {copy ? copy.body : error}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Link
              href={inquiryHref}
              className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-700"
            >
              Back to your inquiry
            </Link>
            {state === "pending" && reference ? (
              <Link
                href={`${inquiryHref}/payment/callback?reference=${encodeURIComponent(reference)}`}
                className="inline-flex items-center justify-center rounded-md border border-hairline bg-surface px-4 py-2 text-[13px] font-semibold text-ink hover:bg-card"
              >
                Check again
              </Link>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
