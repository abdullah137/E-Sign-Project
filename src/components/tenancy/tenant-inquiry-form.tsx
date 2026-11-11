"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, FieldHint, FormField, Input, Select, Textarea } from "@/components/ui/input";
import { apiFetch, ApiClientError } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type GuarantorDraft = { name: string; email: string; relationship: string };

const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed", "Separated", "Prefer not to say"];

const EMPLOYMENT_STATUSES = [
  "Employed full-time",
  "Employed part-time",
  "Self-employed",
  "Contract or freelance",
  "Student",
  "Retired",
  "Unemployed",
  "Other",
];

const RELATIONSHIPS = [
  "Father",
  "Mother",
  "Brother",
  "Sister",
  "Spouse or partner",
  "Employer",
  "Former landlord",
  "Other",
];

export function TenantInquiryForm({
  token,
  workspaceName,
  propertyName,
  propertyReference,
  propertyAddress,
  rentLabel,
  initialUnitId,
  applicantName,
  applicantEmail,
  applicantPhone,
  expiresAtLabel,
  inquiryFeeCents,
}: {
  token: string;
  workspaceName: string;
  propertyName: string;
  propertyReference: string;
  propertyAddress: string;
  rentLabel: string;
  initialUnitId?: string | null;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  expiresAtLabel: string | null;
  inquiryFeeCents: number;
}) {
  const [form, setForm] = useState({
    unitId: initialUnitId ?? "",
    applicantName,
    applicantEmail,
    applicantPhone,
    currentAddress: "",
    currentCity: "",
    currentState: "",
    stateOfOrigin: "",
    maritalStatus: "",
    childrenCount: "0",
    dependentsCount: "0",
    occupantsCount: "1",
    bedroomsRequired: "1",
    employmentStatus: "",
    employer: "",
    occupation: "",
    employmentAddress: "",
    reasonForMoving: "",
    additionalInfo: "",
    signatureName: "",
  });
  const [guarantors, setGuarantors] = useState<GuarantorDraft[]>([]);
  const [passport, setPassport] = useState<{ dataUrl: string; name: string } | null>(null);
  const [passportError, setPassportError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [payment, setPayment] = useState<{
    authorizationUrl: string;
    reference: string;
    amountCents: number;
  } | null>(null);

  const update = (field: keyof typeof form) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const updateGuarantor = (index: number, field: keyof GuarantorDraft) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setGuarantors((current) =>
      current.map((guarantor, itemIndex) =>
        itemIndex === index ? { ...guarantor, [field]: event.target.value } : guarantor,
      ),
    );
  };

  const pickPassport = (file: File | null) => {
    setPassportError(null);
    if (!file) {
      setPassport(null);
      return;
    }
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setPassportError("Upload the passport photo as a PNG or JPEG image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPassportError("The passport photo must be 2 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPassport({ dataUrl: String(reader.result), name: file.name });
    reader.onerror = () => setPassportError("That photo could not be read. Try another file.");
    reader.readAsDataURL(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!confirmed || !acknowledged) {
      setError("Please confirm the declarations before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiFetch<{
        inquiryId: string;
        payment: { authorizationUrl: string; reference: string; amountCents: number } | null;
      }>(`/api/public/inquiry/${encodeURIComponent(token)}/submit`, {
        method: "POST",
        body: JSON.stringify({
          unitId: form.unitId || null,
          currentAddress: form.currentAddress,
          currentCity: form.currentCity || null,
          currentState: form.currentState || null,
          stateOfOrigin: form.stateOfOrigin || null,
          maritalStatus: form.maritalStatus || null,
          childrenCount: form.maritalStatus === "Single" ? 0 : Number(form.childrenCount || 0),
          dependentsCount: Number(form.dependentsCount || 0),
          occupantsCount: Number(form.occupantsCount || 0),
          bedroomsRequired: Number(form.bedroomsRequired || 0),
          employmentStatus: form.employmentStatus || null,
          employer: form.employer || null,
          occupation: form.occupation || null,
          employmentAddress: form.employmentAddress || null,
          reasonForMoving: form.reasonForMoving || null,
          additionalInfo: form.additionalInfo || null,
          declarationAccepted: true,
          signatureName: form.signatureName,
          passportPhoto: passport?.dataUrl ?? "",
          guarantors: guarantors.filter((guarantor) => guarantor.name || guarantor.email),
        }),
      });
      setSubmitted(true);
      if (result.payment) {
        setPayment(result.payment);
        window.location.assign(result.payment.authorizationUrl);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("The inquiry could not be submitted. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-card border border-hairline bg-surface p-6 sm:p-9">
        <span
          className={
            payment
              ? "flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-text"
              : "flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-success-text"
          }
        >
          {payment ? (
            <CreditCard className="h-6 w-6" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          )}
        </span>
        <h1 className="mt-5 font-serif text-[30px] leading-9 text-ink">
          {payment ? "One step left" : "Inquiry submitted"}
        </h1>
        <p className="mt-3 text-[14px] leading-6 text-slate">
          {workspaceName} has received your inquiry for {propertyName} ({propertyReference}).
          {payment
            ? ` Pay the ${formatMoney(payment.amountCents)} inquiry fee on Paystack to send it to the lawyer for review.`
            : " The lawyer will review it before it goes to the landlord. You will receive email updates as the application moves forward."}
        </p>
        {payment ? (
          <div className="mt-5 rounded-lg border border-hairline bg-card px-4 py-4">
            <p className="text-[13px] text-ink">
              Fee due: <span className="font-semibold">{formatMoney(payment.amountCents)}</span>
            </p>
            <p className="mt-1 break-all text-[11.5px] text-slate">Reference {payment.reference}</p>
            <a
              href={payment.authorizationUrl}
              className="mt-3 inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-700"
            >
              Continue to Paystack
            </a>
            <p className="mt-3 text-[11.5px] leading-5 text-slate">
              If you were not redirected automatically, use the button above. The inquiry stays pending until the
              payment is confirmed.
            </p>
          </div>
        ) : null}
        <p className="mt-4 rounded-lg border border-hairline bg-card px-4 py-3 text-[13px] leading-5 text-slate">
          Keep an eye on {form.applicantEmail} for the next step. If you need to correct something,
          contact {workspaceName} directly — this link can only be used once.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="rounded-card border border-hairline bg-surface p-6 sm:p-8">
        <span className="overline">Tenant inquiry</span>
        <h1 className="mt-2 font-serif text-[30px] leading-9 text-ink">{propertyName}</h1>
        <p className="mt-1 text-[13px] text-slate">
          {propertyReference} · {propertyAddress} · {rentLabel}
        </p>
        <p className="mt-4 rounded-lg border border-hairline bg-card px-4 py-3 text-[12.5px] leading-5 text-slate">
          This form goes to {workspaceName}, the lawyer or agency handling the property. If the
          lawyer approves it, the details are shared with the landlord. Provide estimates where you
          do not know exact figures — deliberately false information can lead to the application
          being declined.
          {expiresAtLabel ? ` This link expires on ${expiresAtLabel}.` : ""}
        </p>
        {inquiryFeeCents > 0 ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-hairline bg-surface-subtle px-4 py-3 text-[12.5px] leading-5 text-slate">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
            A {formatMoney(inquiryFeeCents)} inquiry fee is payable on submission. Payment is handled securely by
            Paystack, and the lawyer reviews your inquiry once it is confirmed.
          </p>
        ) : null}
      </div>

      <Section title="Your details" description="Contact details used for this application.">
        <FormField label="Full name" htmlFor="applicantName" required>
          <Input id="applicantName" value={form.applicantName} onChange={update("applicantName")} required />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Email" htmlFor="applicantEmail" required>
            <Input
              id="applicantEmail"
              type="email"
              value={form.applicantEmail}
              onChange={update("applicantEmail")}
              required
            />
          </FormField>
          <FormField label="Phone" htmlFor="applicantPhone" required>
            <Input id="applicantPhone" value={form.applicantPhone} onChange={update("applicantPhone")} required />
          </FormField>
          <FormField label="Marital status" htmlFor="maritalStatus">
            <Select
              id="maritalStatus"
              value={form.maritalStatus}
              onChange={(event) => {
                const maritalStatus = event.target.value;
                setForm((current) => ({
                  ...current,
                  maritalStatus,
                  childrenCount: maritalStatus === "Single" ? "0" : current.childrenCount,
                }));
              }}
            >
              <option value="">Select…</option>
              {MARITAL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="State of origin" htmlFor="stateOfOrigin">
            <Input id="stateOfOrigin" value={form.stateOfOrigin} onChange={update("stateOfOrigin")} maxLength={120} />
          </FormField>
        </div>
        <FormField
          label="Passport photograph"
          htmlFor="passportPhoto"
          hint="PNG or JPEG, up to 2 MB. The reviewing lawyer can view it; it is never published publicly."
        >
          <div className="rounded-lg border border-dashed border-hairline-strong bg-surface-subtle/30 p-4">
            <div className="flex flex-wrap items-center gap-4">
              {passport ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={passport.dataUrl}
                  alt="Passport photograph preview"
                  className="h-24 w-20 rounded border border-hairline bg-white object-cover"
                />
              ) : (
                <span className="flex h-24 w-20 items-center justify-center rounded border border-hairline bg-white text-slate">
                  <Upload className="h-5 w-5" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-hairline bg-card px-3 py-1.5 text-[12px] font-medium text-ink hover:border-brand-500">
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    {passport ? "Change photo" : "Choose photo"}
                    <input
                      id="passportPhoto"
                      type="file"
                      accept="image/png,image/jpeg"
                      className="sr-only"
                      onChange={(event) => {
                        pickPassport(event.target.files?.[0] ?? null);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  {passport ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate hover:text-danger"
                      onClick={() => setPassport(null)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Remove
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 break-all text-[11.5px] leading-5 text-slate">
                  {passport ? passport.name : "No photo selected. You can still submit without one."}
                </p>
              </div>
            </div>
          </div>
          {passportError ? (
            <p className="mt-1.5 text-[12px] text-danger" role="alert">
              {passportError}
            </p>
          ) : null}
        </FormField>
      </Section>

      <Section title="Household" description="Tell us who will live in the property.">
        <div className="grid gap-4 sm:grid-cols-2">
          {form.maritalStatus !== "Single" ? (
            <FormField label="Children" htmlFor="childrenCount" hint="Enter 0 if none.">
              <Input
                id="childrenCount"
                type="number"
                min={0}
                max={20}
                value={form.childrenCount}
                onChange={update("childrenCount")}
              />
            </FormField>
          ) : null}
          <FormField label="Dependents" htmlFor="dependentsCount" hint="Adults or children you support.">
            <Input
              id="dependentsCount"
              type="number"
              min={0}
              max={30}
              value={form.dependentsCount}
              onChange={update("dependentsCount")}
            />
          </FormField>
          <FormField label="People in the compound" htmlFor="occupantsCount" hint="Total occupants including you.">
            <Input
              id="occupantsCount"
              type="number"
              min={0}
              max={30}
              value={form.occupantsCount}
              onChange={update("occupantsCount")}
            />
          </FormField>
          <FormField label="Bedrooms required" htmlFor="bedroomsRequired">
            <Input
              id="bedroomsRequired"
              type="number"
              min={0}
              max={20}
              value={form.bedroomsRequired}
              onChange={update("bedroomsRequired")}
            />
          </FormField>
        </div>
      </Section>

      <Section title="Employment">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Employment status" htmlFor="employmentStatus">
            <Select id="employmentStatus" value={form.employmentStatus} onChange={update("employmentStatus")}>
              <option value="">Select…</option>
              {EMPLOYMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Employer or business" htmlFor="employer">
            <Input id="employer" value={form.employer} onChange={update("employer")} maxLength={160} />
          </FormField>
          <FormField label="Occupation or role" htmlFor="occupation">
            <Input id="occupation" value={form.occupation} onChange={update("occupation")} maxLength={160} />
          </FormField>
          <FormField label="Employment address" htmlFor="employmentAddress">
            <Input
              id="employmentAddress"
              value={form.employmentAddress}
              onChange={update("employmentAddress")}
              maxLength={240}
            />
          </FormField>
        </div>
      </Section>

      <Section title="Current residence">
        <FormField label="Current address" htmlFor="currentAddress" required>
          <Input
            id="currentAddress"
            value={form.currentAddress}
            onChange={update("currentAddress")}
            autoComplete="street-address"
            required
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="City" htmlFor="currentCity">
            <Input id="currentCity" value={form.currentCity} onChange={update("currentCity")} />
          </FormField>
          <FormField label="State or region" htmlFor="currentState">
            <Input id="currentState" value={form.currentState} onChange={update("currentState")} />
          </FormField>
        </div>
        <FormField label="Reason for moving" htmlFor="reasonForMoving" hint="Optional.">
          <Textarea id="reasonForMoving" value={form.reasonForMoving} onChange={update("reasonForMoving")} maxLength={600} />
        </FormField>
      </Section>

      <Section
        title="Guarantor"
        description="Optional. A guarantor may be asked to sign the agreement before it is finalised."
        action={
          guarantors.length < 2 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setGuarantors((current) => [...current, { name: "", email: "", relationship: "" }])
              }
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add guarantor
            </Button>
          ) : null
        }
      >
        {guarantors.length === 0 ? (
          <p className="text-[13px] leading-5 text-slate">
            No guarantor added. You can add up to two people, but it is not required at this stage.
          </p>
        ) : (
          <div className="space-y-4">
            {guarantors.map((guarantor, index) => (
              <div key={index} className="rounded-lg border border-hairline bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-ink">Guarantor {index + 1}</p>
                  <button
                    type="button"
                    onClick={() =>
                      setGuarantors((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    }
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove
                  </button>
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <FormField label="Full name" htmlFor={`guarantor-name-${index}`}>
                    <Input
                      id={`guarantor-name-${index}`}
                      value={guarantor.name}
                      onChange={updateGuarantor(index, "name")}
                      maxLength={120}
                    />
                  </FormField>
                  <FormField label="Email" htmlFor={`guarantor-email-${index}`}>
                    <Input
                      id={`guarantor-email-${index}`}
                      type="email"
                      value={guarantor.email}
                      onChange={updateGuarantor(index, "email")}
                      maxLength={254}
                    />
                  </FormField>
                  <FormField label="Relationship to you" htmlFor={`guarantor-relationship-${index}`}>
                    <Select
                      id={`guarantor-relationship-${index}`}
                      value={guarantor.relationship}
                      onChange={updateGuarantor(index, "relationship")}
                    >
                      <option value="">Select…</option>
                      {RELATIONSHIPS.map((relationship) => (
                        <option key={relationship} value={relationship}>
                          {relationship}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Additional information">
        <FormField
          label="Anything else the reviewer should know"
          htmlFor="additionalInfo"
          hint="Include any notes about the unit, move-in date or special requirements."
        >
          <Textarea
            id="additionalInfo"
            value={form.additionalInfo}
            onChange={update("additionalInfo")}
            maxLength={1200}
          />
        </FormField>
      </Section>

      <Section title="Confirm and submit">
        <FormField
          label="Type your full name to confirm"
          htmlFor="signatureName"
          required
          hint="This acts as your signature on the inquiry."
        >
          <Input
            id="signatureName"
            value={form.signatureName}
            onChange={update("signatureName")}
            autoComplete="name"
            required
          />
        </FormField>
        <div className="space-y-1">
          <Checkbox
            id="confirm-truthful"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            label="The information I have given is accurate to the best of my knowledge. I understand that the lawyer, landlord and any named guarantor may review it, and that false information may lead to my application being declined."
          />
          <Checkbox
            id="confirm-sharing"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            label="I agree to Juripass and the reviewing workspace storing these details and sharing them for this tenancy application."
          />
        </div>
        <p className="flex items-start gap-2 rounded-lg border border-hairline bg-card px-4 py-3 text-[12px] leading-5 text-slate">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          Juripass does not verify identity, income or employment automatically. The lawyer and
          landlord may request supporting documents before approving a tenancy.
        </p>
        {error ? (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-[13px] text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <FieldHint>
            {inquiryFeeCents > 0
              ? `You will be redirected to Paystack to pay the ${formatMoney(inquiryFeeCents)} inquiry fee.`
              : "You will receive a confirmation email after submitting."}
          </FieldHint>
          <Button type="submit" loading={submitting} disabled={!confirmed || !acknowledged}>
            {inquiryFeeCents > 0 ? `Submit and pay ${formatMoney(inquiryFeeCents)}` : "Submit inquiry"}
          </Button>
        </div>
      </Section>
    </form>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-card border border-hairline bg-surface p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-1 text-[12.5px] leading-5 text-slate">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
