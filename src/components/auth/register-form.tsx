"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { AuthCard, AuthMessage } from "./auth-card";
import { PasswordInput } from "./password-input";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { registerSchema } from "@/lib/validation";

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm({
  inviteToken,
  inviteEmail,
  inviteWorkspace,
}: {
  inviteToken?: string;
  inviteEmail?: string;
  inviteWorkspace?: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: inviteEmail ?? "",
      password: "",
      workspaceName: "",
      inviteToken,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await apiFetch<{ redirect: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(values),
      });
      router.push("/auth/verify-required");
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Unable to create your account.");
    }
  });

  return (
    <AuthCard
      overline={inviteWorkspace ? "Team invitation" : "Get started"}
      title={inviteWorkspace ? `Join ${inviteWorkspace}` : "Create your workspace"}
      description={
        inviteWorkspace
          ? "Create your account to collaborate on documents with your team. Your email must match the invitation."
          : "Start sending documents for signature in a calm, private workspace."
      }
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/auth/login" className="font-semibold text-ink hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {serverError ? <AuthMessage tone="error">{serverError}</AuthMessage> : null}
        <div>
          <Label htmlFor="fullName" required>
            Full name
          </Label>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder="Alex Morgan"
            aria-invalid={Boolean(form.formState.errors.fullName) || undefined}
            {...form.register("fullName")}
          />
          <FieldError>{form.formState.errors.fullName?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="email" required>
            Work email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="alex@company.com"
            readOnly={Boolean(inviteEmail)}
            aria-invalid={Boolean(form.formState.errors.email) || undefined}
            {...form.register("email")}
          />
          <FieldError>{form.formState.errors.email?.message}</FieldError>
        </div>
        {!inviteToken ? (
          <div>
            <Label htmlFor="workspaceName">Workspace name</Label>
            <Input
              id="workspaceName"
              placeholder="Morgan Legal"
              aria-invalid={Boolean(form.formState.errors.workspaceName) || undefined}
              {...form.register("workspaceName")}
            />
            <FieldError>{form.formState.errors.workspaceName?.message}</FieldError>
            <p className="mt-1.5 text-[12px] leading-5 text-slate">
              This appears on invitations. You can change it later in settings.
            </p>
          </div>
        ) : (
          <input type="hidden" {...form.register("inviteToken")} />
        )}
        <div>
          <Label htmlFor="password" required>
            Password
          </Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            invalid={Boolean(form.formState.errors.password)}
            {...form.register("password")}
          />
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </div>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          Create account
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        <p className="text-[11.5px] leading-5 text-slate">
          By creating an account you agree to use SignFlow responsibly and to the terms of your
          organisation. SignFlow does not provide legal advice.
        </p>
      </form>
    </AuthCard>
  );
}
