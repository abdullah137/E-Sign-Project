"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthCard, AuthMessage } from "./auth-card";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { workspaceNameSchema } from "@/lib/validation";

type WorkspaceValues = z.infer<typeof workspaceNameSchema>;

export function OnboardingForm({ suggestedName }: { suggestedName: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<WorkspaceValues>({
    resolver: zodResolver(workspaceNameSchema),
    defaultValues: { name: suggestedName },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await apiFetch("/api/auth/workspace", {
        method: "POST",
        body: JSON.stringify(values),
      });
      router.push("/app/dashboard");
      router.refresh();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Unable to create the workspace.");
    }
  });

  return (
    <AuthCard
      overline="One more step"
      title="Name your workspace"
      description="Your workspace holds documents, templates and team members. You can rename it later."
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {serverError ? <AuthMessage tone="error">{serverError}</AuthMessage> : null}
        <div>
          <Label htmlFor="name">Workspace name</Label>
          <Input
            id="name"
            autoFocus
            aria-invalid={Boolean(form.formState.errors.name) || undefined}
            {...form.register("name")}
          />
          <FieldError>{form.formState.errors.name?.message}</FieldError>
        </div>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
          Enter workspace
        </Button>
      </form>
    </AuthCard>
  );
}
