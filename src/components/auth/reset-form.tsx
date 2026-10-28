"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthCard, AuthMessage } from "./auth-card";
import { PasswordInput } from "./password-input";
import { Button } from "@/components/ui/button";
import { Label, FieldError } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { resetSchema } from "@/lib/validation";

const schema = resetSchema
  .extend({ confirm: z.string().min(1, "Confirm your new password.") })
  .refine((value) => value.password === value.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });

type ResetValues = z.infer<typeof schema>;

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ResetValues>({
    resolver: zodResolver(schema),
    defaultValues: { token, password: "", confirm: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const result = await apiFetch<{ redirect: string }>("/api/auth/reset", {
        method: "POST",
        body: JSON.stringify({ token: values.token, password: values.password }),
      });
      router.push(result.redirect);
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Unable to reset your password.");
    }
  });

  return (
    <AuthCard
      overline="Choose a new password"
      title="Secure your account"
      description="Your new password must be at least 8 characters. Existing sessions will be signed out."
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {serverError ? <AuthMessage tone="error">{serverError}</AuthMessage> : null}
        <div>
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            invalid={Boolean(form.formState.errors.password)}
            {...form.register("password")}
          />
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="confirm">Confirm new password</Label>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            placeholder="Repeat your password"
            invalid={Boolean(form.formState.errors.confirm)}
            {...form.register("confirm")}
          />
          <FieldError>{form.formState.errors.confirm?.message}</FieldError>
        </div>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          Reset password
        </Button>
      </form>
    </AuthCard>
  );
}
