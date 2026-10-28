import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/components/auth/reset-form";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <AuthCard
        overline="Invalid link"
        title="This reset link is incomplete"
        description="Reset links must be opened exactly as they were sent. Request a fresh link to continue."
        footer={
          <Link href="/auth/forgot" className="font-semibold text-ink hover:underline">
            Request a new reset link
          </Link>
        }
      >
        <div className="rounded border border-hairline bg-surface-subtle px-4 py-3 text-[13px] leading-6 text-slate">
          For your security, reset links are single-use and expire after one hour.
        </div>
      </AuthCard>
    );
  }
  return <ResetForm token={token} />;
}
