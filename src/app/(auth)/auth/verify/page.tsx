import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { getDb } from "@/lib/db";
import { nowIso } from "@/lib/ids";
import { consumeAuthToken } from "@/lib/account";
import { getSessionUser } from "@/lib/auth";
import { AuthCard } from "@/components/auth/auth-card";
import { buttonStyles } from "@/components/ui/button";

export const metadata: Metadata = { title: "Verify email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const user = await getSessionUser();
  let status: "success" | "invalid" = "invalid";

  if (token) {
    const db = getDb();
    const userId = consumeAuthToken(db, token, "verify_email");
    if (userId) {
      db.prepare(
        "UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?",
      ).run(nowIso(), nowIso(), userId);
      status = "success";
    }
  }

  if (status === "success") {
    return (
      <AuthCard
        overline="Email verified"
        title="You're ready to sign"
        description="Your email address is confirmed. Your workspace is now fully available."
      >
        <div className="mb-6 flex items-start gap-4 rounded border border-[rgba(40,93,57,0.16)] bg-success-bg px-4 py-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-text" aria-hidden="true" />
          <p className="text-[13px] leading-6 text-success-text">
            Verification succeeded. Your account is protected by a secure session.
          </p>
        </div>
        <Link
          href={user ? "/app/dashboard" : "/auth/login"}
          className={buttonStyles("primary", "md", "w-full")}
        >
          {user ? "Go to dashboard" : "Sign in"}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      overline="Link not valid"
      title="We couldn't verify this link"
      description="Verification links expire after 24 hours and can only be used once."
      footer={
        <Link href="/auth/login" className="font-semibold text-ink hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="flex items-start gap-4 rounded border border-[rgba(186,26,26,0.16)] bg-[#FCF1F1] px-4 py-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
        <p className="text-[13px] leading-6 text-danger">
          If you still need to verify your email, sign in and request a new verification
          message.
        </p>
      </div>
    </AuthCard>
  );
}
