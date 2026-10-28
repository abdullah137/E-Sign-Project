"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MailCheck } from "lucide-react";
import { AuthCard, AuthMessage } from "./auth-card";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { forgotSchema } from "@/lib/validation";

type ForgotValues = z.infer<typeof forgotSchema>;

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await apiFetch("/api/auth/forgot", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setSent(true);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Unable to send the reset email.");
    }
  });

  if (sent) {
    return (
      <AuthCard
        overline="Check your inbox"
        title="Reset link sent"
        description="If an account exists for that email address, a single-use reset link is on its way. It expires in one hour."
        footer={
          <Link href="/auth/login" className="font-semibold text-ink hover:underline">
            Return to sign in
          </Link>
        }
      >
        <div className="flex items-start gap-4 rounded border border-hairline bg-surface-subtle px-4 py-4">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold-text" aria-hidden="true" />
          <p className="text-[13px] leading-6 text-ink-secondary">
            Didn&apos;t receive it? Check your spam folder, or wait a few minutes and try again.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      overline="Account recovery"
      title="Reset your password"
      description="Enter the email address associated with your account. We will send a secure, single-use link."
      footer={
        <Link href="/auth/login" className="font-semibold text-ink hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {serverError ? <AuthMessage tone="error">{serverError}</AuthMessage> : null}
        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={Boolean(form.formState.errors.email) || undefined}
            {...form.register("email")}
          />
          <FieldError>{form.formState.errors.email?.message}</FieldError>
        </div>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}
