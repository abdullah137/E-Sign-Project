import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export const metadata: Metadata = { title: "Create workspace" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  if (!user.email_verified_at) redirect("/auth/verify-required");
  const db = getDb();
  const membership = db.prepare("SELECT id FROM memberships WHERE user_id = ?").get(user.id);
  if (membership) redirect("/app/dashboard");
  const firstName = user.full_name.trim().split(/\s+/)[0] || "My";
  return <OnboardingForm suggestedName={`${firstName} workspace`} />;
}
