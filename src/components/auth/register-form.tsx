"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Upload } from "lucide-react";
import { AuthCard, AuthMessage } from "./auth-card";
import { PasswordInput } from "./password-input";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, Checkbox, Select } from "@/components/ui/input";
import { CountryDialSelect } from "@/components/ui/country-dial-select";
import { apiFetch } from "@/lib/client";
import { registerSchema } from "@/lib/validation";
import { BANK_ACCOUNT_TYPES, NIGERIAN_BANKS } from "@/lib/banks";
import { DEFAULT_COUNTRY_ISO, findCountryDialCode } from "@/lib/country-codes";

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm({
  inviteToken,
  inviteEmail,
  prefillEmail,
  inviteWorkspace,
  selectedPlan,
}: {
  inviteToken?: string;
  inviteEmail?: string;
  prefillEmail?: string;
  inviteWorkspace?: string;
  selectedPlan?: { name: string; price: string };
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [hasLawFirm, setHasLawFirm] = useState(false);
  const [hasBank, setHasBank] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_COUNTRY_ISO);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: inviteEmail ?? prefillEmail ?? "",
      password: "",
      workspaceName: "",
      lawFirmEmail: "",
      lawFirmPhone: "",
      lawFirmAddress: "",
      lawFirmLogo: "",
      bankName: "",
      bankCode: "",
      bankAccountName: "",
      bankAccountNumber: "",
      bankAccountType: "Savings",
      inviteToken,
    },
  });

  const toggleLawFirm = (checked: boolean) => {
    setHasLawFirm(checked);
    if (!checked) {
      form.setValue("workspaceName", "");
      form.setValue("lawFirmEmail", "");
      form.setValue("lawFirmPhone", "");
      form.setValue("lawFirmAddress", "");
      form.setValue("lawFirmLogo", "");
      setLogoPreview(null);
      setLogoError(null);
      form.clearErrors(["workspaceName", "lawFirmEmail", "lawFirmPhone", "lawFirmAddress", "lawFirmLogo"]);
    }
  };

  const toggleBank = (checked: boolean) => {
    setHasBank(checked);
    if (!checked) {
      form.setValue("bankName", "");
      form.setValue("bankCode", "");
      form.setValue("bankAccountName", "");
      form.setValue("bankAccountNumber", "");
      form.setValue("bankAccountType", "Savings");
      form.clearErrors(["bankName", "bankAccountName", "bankAccountNumber", "bankAccountType"]);
    }
  };

  const pickLogo = (file: File | null) => {
    setLogoError(null);
    if (!file) {
      form.setValue("lawFirmLogo", "");
      setLogoPreview(null);
      return;
    }
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      setLogoError("Choose a PNG or JPEG image.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setLogoError("The logo must be 1 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      form.setValue("lawFirmLogo", dataUrl, { shouldValidate: true });
      setLogoPreview(dataUrl);
    };
    reader.onerror = () => setLogoError("The logo could not be read. Try another file.");
    reader.readAsDataURL(file);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const dial = findCountryDialCode(phoneCountry)?.dial ?? "+1";
    const phoneNumber = values.lawFirmPhone?.trim() ?? "";
    try {
      await apiFetch<{ redirect: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          lawFirmPhone: phoneNumber ? `${dial} ${phoneNumber}` : "",
          bankCode: hasBank
            ? NIGERIAN_BANKS.find((bank) => bank.name === values.bankName)?.code ?? ""
            : "",
        }),
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
        {selectedPlan ? (
          <AuthMessage tone="info">
            <span className="font-semibold text-ink">
              {selectedPlan.name} selected — {selectedPlan.price}/month.
            </span>{" "}
            Creating an account does not start a subscription or charge a card. After verifying your
            email, you can request activation from Billing.
          </AuthMessage>
        ) : null}
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
          <>
            <div className="rounded border border-hairline bg-surface-subtle/40 px-4 py-2">
              <Checkbox
                id="hasLawFirm"
                checked={hasLawFirm}
                onChange={(event) => toggleLawFirm(event.target.checked)}
                label={
                  <span>
                    <span className="font-semibold text-ink">I have a law firm</span>
                    <span className="block text-[12px] leading-5 text-slate">
                      Tick to add your firm&apos;s name, email, phone and address. These details appear on
                      inquiries and tenancy agreements. You can add them later in settings.
                    </span>
                  </span>
                }
              />
            </div>
            {hasLawFirm ? (
              <>
                <div>
                  <Label htmlFor="workspaceName">Law firm name</Label>
                  <Input
                    id="workspaceName"
                    placeholder="Morgan Legal"
                    aria-invalid={Boolean(form.formState.errors.workspaceName) || undefined}
                    {...form.register("workspaceName")}
                  />
                  <FieldError>{form.formState.errors.workspaceName?.message}</FieldError>
                  <p className="mt-1.5 text-[12px] leading-5 text-slate">
                    This is your firm&apos;s name on invitations, inquiries and tenancy agreements. You can change it
                    later in settings.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="lawFirmEmail">Law firm email</Label>
                    <Input
                      id="lawFirmEmail"
                      type="email"
                      placeholder="firm@company.com"
                      aria-invalid={Boolean(form.formState.errors.lawFirmEmail) || undefined}
                      {...form.register("lawFirmEmail")}
                    />
                    <FieldError>{form.formState.errors.lawFirmEmail?.message}</FieldError>
                  </div>
                  <div>
                    <Label htmlFor="lawFirmPhone">Law firm phone</Label>
                    <div className="flex gap-2">
                      <CountryDialSelect
                        value={phoneCountry}
                        onChange={setPhoneCountry}
                        className="w-[7.5rem] shrink-0"
                      />
                      <Input
                        id="lawFirmPhone"
                        inputMode="tel"
                        placeholder="512 555 0100"
                        aria-invalid={Boolean(form.formState.errors.lawFirmPhone) || undefined}
                        {...form.register("lawFirmPhone")}
                      />
                    </div>
                    <FieldError>{form.formState.errors.lawFirmPhone?.message}</FieldError>
                  </div>
                </div>
                <div>
                  <Label htmlFor="lawFirmAddress">Law firm address</Label>
                  <Input
                    id="lawFirmAddress"
                    placeholder="100 Congress Avenue, Austin, TX"
                    aria-invalid={Boolean(form.formState.errors.lawFirmAddress) || undefined}
                    {...form.register("lawFirmAddress")}
                  />
                  <FieldError>{form.formState.errors.lawFirmAddress?.message}</FieldError>
                </div>
                <div>
                  <Label htmlFor="lawFirmLogo">Firm logo</Label>
                  <div className="w-full rounded border border-dashed border-hairline-strong bg-surface-subtle/30 p-3">
                    <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded border border-hairline bg-white p-3">
                      {logoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoPreview}
                          alt="Firm logo preview"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-[12px] text-slate">No logo selected</span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-hairline bg-card px-3 py-1.5 text-[12px] font-medium text-ink hover:border-brand-500">
                        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                        {logoPreview ? "Change logo" : "Choose logo"}
                        <input
                          id="lawFirmLogo"
                          type="file"
                          accept="image/png,image/jpeg"
                          className="sr-only"
                          onChange={(event) => {
                            pickLogo(event.target.files?.[0] ?? null);
                            event.target.value = "";
                          }}
                        />
                      </label>
                      {logoPreview ? (
                        <button
                          type="button"
                          className="text-[12px] font-medium text-slate hover:text-ink hover:underline"
                          onClick={() => pickLogo(null)}
                        >
                          Remove
                        </button>
                      ) : null}
                      <p className="w-full text-[11.5px] leading-5 text-slate sm:w-auto sm:flex-1">
                        Optional. PNG or JPEG up to 1 MB. Used on the letterhead of agreements and inquiries.
                      </p>
                    </div>
                  </div>
                  <input type="hidden" {...form.register("lawFirmLogo")} />
                  {logoError ? <p className="mt-1.5 text-[12px] text-danger" role="alert">{logoError}</p> : null}
                  <FieldError>{form.formState.errors.lawFirmLogo?.message}</FieldError>
                </div>
                <p className="rounded border border-hairline bg-surface-subtle/60 px-4 py-3 text-[12px] leading-5 text-slate">
                  The firm email and name are used as the lawyer signatory when a tenancy agreement is prepared, so
                  you will not need to re-enter them each time.
                </p>
              </>
            ) : null}
            <div className="rounded border border-hairline bg-surface-subtle/40 px-4 py-2">
              <Checkbox
                id="hasBank"
                checked={hasBank}
                onChange={(event) => toggleBank(event.target.checked)}
                label={
                  <span>
                    <span className="font-semibold text-ink">Add a payout bank account</span>
                    <span className="block text-[12px] leading-5 text-slate">
                      Used to settle inquiry fees collected through Juripass. You can add or change these
                      details later in Settings → Profile.
                    </span>
                  </span>
                }
              />
            </div>
            {hasBank ? (
              <>
                <div>
                  <Label htmlFor="bankName">Bank name</Label>
                  <Select
                    id="bankName"
                    aria-invalid={Boolean(form.formState.errors.bankName) || undefined}
                    {...form.register("bankName")}
                  >
                    <option value="">Select your bank</option>
                    {NIGERIAN_BANKS.map((bank) => (
                      <option key={bank.code} value={bank.name}>
                        {bank.name}
                      </option>
                    ))}
                  </Select>
                  <FieldError>{form.formState.errors.bankName?.message}</FieldError>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="bankAccountType">Bank type</Label>
                    <Select
                      id="bankAccountType"
                      aria-invalid={Boolean(form.formState.errors.bankAccountType) || undefined}
                      {...form.register("bankAccountType")}
                    >
                      {BANK_ACCOUNT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </Select>
                    <FieldError>{form.formState.errors.bankAccountType?.message}</FieldError>
                  </div>
                  <div>
                    <Label htmlFor="bankAccountNumber">Account number</Label>
                    <Input
                      id="bankAccountNumber"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="0123456789"
                      aria-invalid={Boolean(form.formState.errors.bankAccountNumber) || undefined}
                      {...form.register("bankAccountNumber")}
                    />
                    <FieldError>{form.formState.errors.bankAccountNumber?.message}</FieldError>
                  </div>
                </div>
                <div>
                  <Label htmlFor="bankAccountName">Account name</Label>
                  <Input
                    id="bankAccountName"
                    placeholder="As it appears on the bank statement"
                    aria-invalid={Boolean(form.formState.errors.bankAccountName) || undefined}
                    {...form.register("bankAccountName")}
                  />
                  <FieldError>{form.formState.errors.bankAccountName?.message}</FieldError>
                </div>
              </>
            ) : null}
            <p className="rounded border border-hairline bg-surface-subtle/60 px-4 py-3 text-[12px] leading-5 text-slate">
              After verifying your email, finish your profile in Settings. Add your firm logo, display name
              and accent colour under <span className="font-semibold text-ink">Branding</span>, and update the
              payout account under <span className="font-semibold text-ink">Profile</span>.
            </p>
          </>
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
          By creating an account you agree to use Juripass responsibly and to the terms of your
          organisation. Juripass does not provide legal advice.
        </p>
      </form>
    </AuthCard>
  );
}
