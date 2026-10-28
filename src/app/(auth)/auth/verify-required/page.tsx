import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerification } from "@/components/auth/resend-verification";
import { SignOutButton } from "@/components/app/sign-out-button";

export const metadata: Metadata = { title: "Verify your email" };
export const dynamic = "force-dynamic";

export default async function VerifyRequiredPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (user.email_verified_at) redirect("/app/dashboard");

  return (
    <AuthCard
      overline="One quick check"
      title="Verify your email address"
      description={`We sent a verification link to ${user.email}. Use it to unlock your workspace.`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>Wrong account?</span>
          <SignOutButton variant="ghost" />
        </div>
      }
    >
      <div className="mb-5 flex items-start gap-4 rounded border border-hairline bg-surface-subtle px-4 py-4">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold-text" aria-hidden="true" />
        <p className="text-[13px] leading-6 text-ink-secondary">
          Verification keeps invitations, signing links and completed documents tied to a
          confirmed address. The link expires after 24 hours.
        </p>
      </div>
      <ResendVerification />
      {env.showDevOutbox ? (
        <div className="mt-5 border-t border-hairline pt-4">
          <p className="text-[12px] leading-5 text-slate">
            Local development: e-mails are captured instead of delivered.{" "}
            <Link href="/dev/outbox" className="font-semibold text-gold-text hover:underline">
              Open the development outbox
            </Link>{" "}
            to retrieve your verification link.
          </p>
        </div>
      ) : null}
    </AuthCard>
  );
}
