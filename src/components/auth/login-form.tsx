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
import { loginSchema } from "@/lib/validation";

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const result = await apiFetch<{ redirect: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      const target =
        nextPath && nextPath.startsWith("/app") ? nextPath : result.redirect;
      router.push(target);
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Unable to sign in.");
    }
  });

  return (
    <AuthCard
      overline="Welcome back"
      title="Sign in to SignFlow"
      description="Access your documents, templates and signing activity."
      footer={
        <p>
          New to SignFlow?{" "}
          <Link href="/auth/register" className="font-semibold text-ink hover:underline">
            Create an account
          </Link>
        </p>
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
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/auth/forgot" className="mb-1.5 text-[12px] font-medium text-gold-text hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            invalid={Boolean(form.formState.errors.password)}
            {...form.register("password")}
          />
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </div>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          Sign in
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
    </AuthCard>
  );
}
