"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/format";

export function ProfileForm({
  initialName,
  email,
  memberSince,
  verified,
  role,
}: {
  initialName: string;
  email: string;
  memberSince: string;
  verified: boolean;
  role: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const saveName = async () => {
    if (name.trim().length < 2) {
      setNameError("Enter your name.");
      return;
    }
    setNameSaving(true);
    setNameError(null);
    try {
      await apiFetch("/api/account/profile", {
        method: "PATCH",
        body: JSON.stringify({ fullName: name.trim() }),
      });
      toast({ title: "Profile updated", variant: "success" });
      router.refresh();
    } catch (error) {
      setNameError(error instanceof Error ? error.message : "Your name could not be saved.");
    } finally {
      setNameSaving(false);
    }
  };

  const savePassword = async () => {
    if (newPassword.length < 8) {
      setPasswordError("Use at least 8 characters for the new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    try {
      await apiFetch("/api/account/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Password changed",
        description: "Other sessions have been signed out.",
        variant: "success",
      });
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "The password could not be changed.");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-subtle text-slate">
            <UserRound className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Your profile</h2>
            <p className="mt-0.5 text-[12px] text-slate">
              This name appears on documents you send and in the audit trail.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="profile-name" required>
              Full name
            </Label>
            <Input
              id="profile-name"
              value={name}
              maxLength={80}
              onChange={(event) => {
                setName(event.target.value);
                setNameError(null);
              }}
            />
            <FieldError>{nameError}</FieldError>
          </div>
          <div>
            <Label htmlFor="profile-email">Email address</Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder"
                aria-hidden="true"
              />
              <Input id="profile-email" value={email} readOnly className="pl-10" />
            </div>
            <p className="mt-1.5 text-[11.5px] leading-5 text-slate">
              {verified ? "Verified" : "Not verified"} · Changing your sign-in email is not available
              in this deployment.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11.5px] text-slate">
            <span>
              Role <span className="font-medium capitalize text-ink-secondary">{role}</span>
            </span>
            <span>
              Member since <span className="font-medium text-ink-secondary">{formatDate(memberSince)}</span>
            </span>
          </div>
          <Button onClick={saveName} loading={nameSaving} disabled={name.trim() === initialName}>
            Save profile
          </Button>
        </div>
      </section>

      <section className="card p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-subtle text-slate">
            <KeyRound className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Password</h2>
            <p className="mt-0.5 text-[12px] text-slate">
              Changing your password signs out every other session.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setPasswordError(null);
              }}
            />
          </div>
          <div>
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                setPasswordError(null);
              }}
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setPasswordError(null);
              }}
            />
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <FieldError>{passwordError}</FieldError>
          <Button
            className="sm:ml-auto"
            onClick={savePassword}
            loading={passwordSaving}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          >
            Update password
          </Button>
        </div>
      </section>
    </div>
  );
}
