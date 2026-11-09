"use client";

import { useState } from "react";
import { CheckCircle2, Download, ShieldAlert, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldHint, FormField, Textarea } from "@/components/ui/input";
import { apiFetch, ApiClientError } from "@/lib/client";

export type LandlordDecision = "approve" | "decline" | null;

export function LandlordReview({
  token,
  workspaceName,
  propertyName,
  propertyReference,
  propertyAddress,
  unitLabel,
  rentLabel,
  applicantName,
  applicantEmail,
  applicantPhone,
  currentAddress,
  reasonForMoving,
  maritalStatus,
  childrenCount,
  dependentsCount,
  employmentStatus,
  employer,
  occupation,
  incomeRange,
  religionState,
  notes,
  guarantors,
  submittedAtLabel,
  decision,
  landlordComment,
}: {
  token: string;
  workspaceName: string;
  propertyName: string;
  propertyReference: string;
  propertyAddress: string;
  unitLabel?: string | null;
  rentLabel: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  currentAddress: string | null;
  reasonForMoving: string | null;
  maritalStatus: string | null;
  childrenCount: number | null;
  dependentsCount: number | null;
  employmentStatus: string | null;
  employer: string | null;
  occupation: string | null;
  incomeRange: string | null;
  religionState: string | null;
  notes: string | null;
  guarantors: Array<{ name: string; email: string; relationship: string }>;
  submittedAtLabel: string | null;
  decision: LandlordDecision;
  landlordComment: string | null;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"approve" | "decline" | null>(null);
  const [result, setResult] = useState<LandlordDecision>(decision);

  const submit = async (choice: "approve" | "decline") => {
    setError(null);
    if (choice === "decline" && comment.trim().length < 3) {
      setError("Add a short reason so the lawyer can explain the decision to the applicant.");
      return;
    }
    setPending(choice);
    try {
      await apiFetch(`/api/public/landlord/${encodeURIComponent(token)}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision: choice, comment: comment.trim() || null }),
      });
      setResult(choice);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "The decision could not be saved.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-hairline bg-surface p-6 sm:p-8">
        <span className="overline">Landlord review</span>
        <h1 className="mt-2 font-serif text-[30px] leading-9 text-ink">{propertyName}</h1>
        <p className="mt-1 text-[13px] text-slate">
          {propertyReference} · {unitLabel ? `${unitLabel} · ` : ""}
          {propertyAddress} · {rentLabel}
        </p>
        <p className="mt-4 text-[13px] leading-6 text-slate">
          {workspaceName} reviewed {applicantName}&apos;s inquiry and forwarded it for your
          decision. Approving allows the lawyer to prepare the tenancy agreement. Declining stops
          this application.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a
            href={`/api/public/landlord/${encodeURIComponent(token)}/pdf`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline-strong bg-card px-3.5 text-[13px] font-medium text-ink hover:bg-surface-subtle"
          >
            <Download className="h-4 w-4 text-brand-600" aria-hidden="true" />
            Download summary PDF
          </a>
          {submittedAtLabel ? (
            <span className="text-[12px] text-slate">Submitted {submittedAtLabel}</span>
          ) : null}
        </div>
      </div>

      <Section title="Applicant">
        <dl className="grid gap-4 text-[13px] sm:grid-cols-2">
          <Item label="Full name" value={applicantName} />
          <Item label="Email" value={applicantEmail} />
          <Item label="Phone" value={applicantPhone || "Not provided"} />
          <Item label="Current address" value={currentAddress || "Not provided"} />
          <Item label="Marital status" value={maritalStatus || "Not provided"} />
          {maritalStatus === "Single" ? null : (
            <Item
              label="Children"
              value={childrenCount === null ? "Not provided" : String(childrenCount)}
            />
          )}
          <Item
            label="Dependents"
            value={dependentsCount === null ? "Not provided" : String(dependentsCount)}
          />
          <Item label="Employment" value={employmentStatus || "Not provided"} />
          <Item label="Employer" value={employer || "Not provided"} />
          <Item label="Occupation" value={occupation || "Not provided"} />
          <Item label="Income range" value={incomeRange || "Not provided"} />
          {religionState ? <Item label="Religion or state" value={religionState} /> : null}
          <Item label="Reason for moving" value={reasonForMoving || "Not provided"} />
        </dl>
        {notes ? (
          <div className="mt-4 rounded-lg border border-hairline bg-card px-4 py-3">
            <p className="text-[12px] font-medium text-slate">Additional notes</p>
            <p className="mt-1 whitespace-pre-line text-[13px] leading-6 text-ink">{notes}</p>
          </div>
        ) : null}
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-hairline bg-warning-bg px-4 py-3 text-[12px] leading-5 text-gold-text">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          These details are self-reported by the applicant. Juripass does not verify identity,
          income or employment automatically. Ask the lawyer for supporting documents before you
          rely on them.
        </p>
      </Section>

      <Section title="Guarantor">
        {guarantors.length === 0 ? (
          <p className="text-[13px] text-slate">No guarantor was added to this inquiry.</p>
        ) : (
          <ul className="space-y-2">
            {guarantors.map((guarantor) => (
              <li
                key={`${guarantor.email}-${guarantor.name}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline bg-card px-4 py-3 text-[13px]"
              >
                <span className="font-medium text-ink">{guarantor.name}</span>
                <span className="text-slate">
                  {guarantor.relationship} · {guarantor.email}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {result ? (
        <div className="rounded-card border border-hairline bg-surface p-6 sm:p-8">
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-full ${
              result === "approve" ? "bg-success-bg text-success-text" : "bg-danger-bg text-danger"
            }`}
          >
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-[18px] font-semibold text-ink">
            {result === "approve" ? "You approved this inquiry" : "You declined this inquiry"}
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-slate">
            {result === "approve"
              ? "The lawyer has been notified and can now prepare the tenancy agreement. The agreement needs signatures from the tenant, guarantor (if any) and you before it is finalised."
              : "The lawyer and applicant have been notified. No tenancy agreement will be prepared for this inquiry unless the decision changes."}
          </p>
          {landlordComment ? (
            <p className="mt-3 rounded-lg border border-hairline bg-card px-4 py-3 text-[13px] text-slate">
              Your comment: {landlordComment}
            </p>
          ) : null}
        </div>
      ) : (
        <Section
          title="Your decision"
          description="Your decision is recorded with a timestamp on the inquiry activity log."
        >
          <FormField
            label="Comment to the lawyer"
            htmlFor="landlord-comment"
            hint="Required when declining. Optional when approving."
          >
            <Textarea
              id="landlord-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1000}
              placeholder="Add a reason or any conditions for the lawyer to consider."
            />
          </FormField>
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-[13px] text-danger"
            >
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={() => submit("approve")}
              loading={pending === "approve"}
              disabled={pending !== null}
            >
              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
              Approve inquiry
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => submit("decline")}
              loading={pending === "decline"}
              disabled={pending !== null}
            >
              <ThumbsDown className="h-4 w-4" aria-hidden="true" />
              Decline inquiry
            </Button>
          </div>
          <FieldHint>This decision can only be submitted once.</FieldHint>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-card border border-hairline bg-surface p-6 sm:p-8">
      <div>
        <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 text-[12.5px] leading-5 text-slate">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] font-medium text-slate">{label}</dt>
      <dd className="mt-0.5 break-words leading-6 text-ink">{value}</dd>
    </div>
  );
}
