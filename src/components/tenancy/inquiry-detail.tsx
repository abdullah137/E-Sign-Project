"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Download,
  FileSignature,
  FileText,
  Link2,
  Mail,
  Pencil,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { FormField, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiClientError } from "@/lib/client";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import { INQUIRY_EVENT_LABELS, INQUIRY_STATUS_META } from "@/lib/tenancy-status";
import { formatMoney } from "@/lib/money";
import type {
  CaseEventRow,
  GuarantorRow,
  InquiryFileRow,
  InquiryRow,
  PropertyListingType,
  PropertyUnitListRow,
  PropertyUnitRow,
} from "@/lib/tenancy";

export interface PrecedentOption {
  id: string;
  title: string;
  category: string;
}

export function InquiryDetail({
  inquiry,
  property,
  unit,
  units,
  landlord,
  guarantors,
  files,
  agreement,
  events,
  precedents,
}: {
  inquiry: InquiryRow;
  property: {
    id: string;
    name: string;
    reference: string;
    address: string;
    bedrooms: number;
    bathrooms: number;
    listingType: PropertyListingType;
    rentAmountCents: number;
    defaultInquiryFeeCents: number;
  };
  unit: PropertyUnitRow | null;
  units: PropertyUnitListRow[];
  landlord: { id: string; name: string; email: string; phone: string };
  guarantors: GuarantorRow[];
  files: InquiryFileRow[];
  agreement: { id: string; document_id: string } | null;
  events: CaseEventRow[];
  precedents: PrecedentOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const meta = INQUIRY_STATUS_META[inquiry.status];
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  const [agreementOpen, setAgreementOpen] = useState(false);
  const [agreementSaving, setAgreementSaving] = useState(false);
  const [agreementError, setAgreementError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  const [agreementForm, setAgreementForm] = useState({
    precedentId: precedents[0]?.id ?? "",
    startDate: today,
    endDate: nextYear,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    applicantName: inquiry.applicant_name,
    applicantEmail: inquiry.applicant_email,
    applicantPhone: inquiry.applicant_phone,
    unitId: inquiry.unit_id ?? "",
    lawyerNote: inquiry.lawyer_note ?? "",
    inquiryFee: nairaInput(inquiry.inquiry_fee_cents ?? property.defaultInquiryFeeCents),
  });
  const canEdit = inquiry.status === "DRAFT" || inquiry.status === "SUBMITTED";
  const feeCents =
    inquiry.status === "DRAFT"
      ? inquiry.inquiry_fee_cents ?? property.defaultInquiryFeeCents
      : inquiry.payment_fee_cents;
  const paymentDue = inquiry.payment_fee_cents > 0 && inquiry.payment_status !== "paid";
  const paymentLabel =
    inquiry.payment_status === "paid"
      ? "Paid"
      : inquiry.payment_status === "failed"
        ? "Failed"
        : inquiry.payment_status === "pending"
          ? "Awaiting payment"
          : "Not required";

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "That action could not be completed.");
    } finally {
      setBusy(null);
    }
  };

  const review = (decision: "approve" | "decline") =>
    run(decision, async () => {
      await apiFetch(`/api/tenancy/inquiries/${inquiry.id}/review`, {
        method: "POST",
        body: JSON.stringify({ decision, note: note.trim() || null }),
      });
      toast({
        title: decision === "approve" ? "Inquiry approved" : "Inquiry declined",
        description:
          decision === "approve"
            ? "Forward it to the landlord when you are ready."
            : "The applicant has been notified by email.",
      });
      router.refresh();
    });

  const resend = () =>
    run("resend", async () => {
      const result = await apiFetch<{ demoLink?: string }>(
        `/api/tenancy/inquiries/${inquiry.id}/resend`,
        { method: "POST" },
      );
      setDevLink(result.demoLink ?? null);
      toast({ title: "Form resent", description: `A fresh link was emailed to ${inquiry.applicant_email}.` });
      router.refresh();
    });

  const forward = () =>
    run("forward", async () => {
      const result = await apiFetch<{ demoLink?: string; expiresAt: string }>(
        `/api/tenancy/inquiries/${inquiry.id}/forward`,
        { method: "POST" },
      );
      setDevLink(result.demoLink ?? null);
      toast({ title: "Forwarded to the landlord", description: `${landlord.name} can now review the inquiry.` });
      router.refresh();
    });

  const createAgreement = async (event: React.FormEvent) => {
    event.preventDefault();
    setAgreementSaving(true);
    setAgreementError(null);
    try {
      const result = await apiFetch<{ redirect: string }>("/api/tenancy/agreements", {
        method: "POST",
        body: JSON.stringify({
          inquiryId: inquiry.id,
          precedentId: agreementForm.precedentId,
          startDate: agreementForm.startDate,
          endDate: agreementForm.endDate,
        }),
      });
      setAgreementOpen(false);
      router.push(result.redirect);
    } catch (err) {
      setAgreementError(err instanceof ApiClientError ? err.message : "The agreement could not be prepared.");
    } finally {
      setAgreementSaving(false);
    }
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    const feeNaira = Number(editForm.inquiryFee);
    if (
      inquiry.status === "DRAFT" &&
      (!Number.isFinite(feeNaira) || feeNaira < 0 || feeNaira > 1_000_000)
    ) {
      setEditError("Enter an inquiry fee between ₦0 and ₦1,000,000.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await apiFetch(`/api/tenancy/inquiries/${inquiry.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          applicantName: editForm.applicantName,
          applicantEmail: editForm.applicantEmail,
          applicantPhone: editForm.applicantPhone,
          unitId: editForm.unitId || null,
          lawyerNote: editForm.lawyerNote || null,
          ...(inquiry.status === "DRAFT"
            ? { inquiryFeeCents: Math.round(feeNaira * 100) }
            : {}),
        }),
      });
      toast({ title: "Inquiry updated", description: "The applicant details have been saved." });
      setEditOpen(false);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof ApiClientError ? err.message : "The inquiry could not be saved.");
    } finally {
      setEditSaving(false);
    }
  };

  const removeInquiry = async () => {
    if (!window.confirm(`Delete the inquiry from ${inquiry.applicant_name}? This cannot be undone.`)) return;
    setBusy("delete");
    setError(null);
    try {
      await apiFetch(`/api/tenancy/inquiries/${inquiry.id}`, { method: "DELETE" });
      toast({ title: "Inquiry deleted", description: `${inquiry.applicant_name}'s inquiry was removed.` });
      router.push("/app/inquiries");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "The inquiry could not be deleted.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-card border border-hairline bg-surface p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge tone={meta.tone} dot>
                {meta.label}
              </Badge>
              <span className="text-[12px] text-slate">
                {inquiry.submitted_at ? `Submitted ${formatDate(inquiry.submitted_at)}` : "Not submitted yet"}
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-[13.5px] leading-6 text-slate">{meta.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {inquiry.status !== "DRAFT" ? (
              <a
                href={`/api/tenancy/inquiries/${inquiry.id}/pdf`}
                className={buttonStyles("secondary", "sm")}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Summary PDF
              </a>
            ) : null}
            {inquiry.status === "DRAFT" ? (
              <Button type="button" variant="secondary" size="sm" loading={busy === "resend"} onClick={resend}>
                <Mail className="h-4 w-4" aria-hidden="true" />
                Resend form
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditForm({
                    applicantName: inquiry.applicant_name,
                    applicantEmail: inquiry.applicant_email,
                    applicantPhone: inquiry.applicant_phone,
                    unitId: inquiry.unit_id ?? "",
                    lawyerNote: inquiry.lawyer_note ?? "",
                    inquiryFee: nairaInput(inquiry.inquiry_fee_cents ?? property.defaultInquiryFeeCents),
                  });
                  setEditError(null);
                  setEditOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
            ) : null}
            {!agreement ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={busy === "delete"}
                onClick={removeInquiry}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            ) : null}
            {inquiry.status === "APPROVED" ? (
              <Button type="button" size="sm" loading={busy === "forward"} onClick={forward}>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                Forward to landlord
              </Button>
            ) : null}
            {inquiry.status === "LANDLORD_APPROVED" ? (
              <Button type="button" size="sm" onClick={() => setAgreementOpen(true)}>
                <FileSignature className="h-4 w-4" aria-hidden="true" />
                Prepare agreement
              </Button>
            ) : null}
            {agreement ? (
              <Link
                href={`/app/documents/${agreement.document_id}`}
                className={buttonStyles("primary", "sm")}
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                Open agreement
              </Link>
            ) : null}
          </div>
        </div>

        {devLink ? (
          <div className="mt-5 rounded-lg border border-hairline bg-card px-4 py-3">
            <p className="text-[12px] font-semibold text-ink">Development link</p>
            <p className="mt-1 break-all text-[12px] text-slate">{devLink}</p>
            <p className="mt-1 text-[11.5px] text-slate">
              Shown because the development outbox is enabled. In production this link is only sent by email.
            </p>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="mt-5 rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-[13px] text-danger">
            {error}
          </p>
        ) : null}
      </section>

      {inquiry.status === "SUBMITTED" ? (
        <section className="rounded-card border border-hairline bg-surface p-6 sm:p-7">
          <h2 className="text-[16px] font-semibold text-ink">Your review</h2>
          <p className="mt-1 text-[12.5px] leading-5 text-slate">
            Approving sends the inquiry to the landlord. Declining stops it here and notifies the applicant.
          </p>
          <div className="mt-4">
            <FormField label="Review note" htmlFor="review-note" hint="Optional. Shared in the applicant email and activity log.">
              <Textarea id="review-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} />
            </FormField>
          </div>
          {paymentDue ? (
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-hairline bg-warning-bg px-4 py-3 text-[12.5px] leading-5 text-gold-text">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {formatMoney(inquiry.payment_fee_cents)} inquiry fee is not paid yet. Approval unlocks once Paystack
              confirms the payment.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              loading={busy === "approve"}
              onClick={() => review("approve")}
              disabled={busy !== null || paymentDue}
            >
              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
              Approve inquiry
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={busy === "decline"}
              onClick={() => review("decline")}
              disabled={busy !== null}
            >
              <ThumbsDown className="h-4 w-4" aria-hidden="true" />
              Decline inquiry
            </Button>
          </div>
        </section>
      ) : null}

      {inquiry.status === "APPROVED" ? (
        <section className="rounded-card border border-hairline bg-surface p-6 sm:p-7">
          <h2 className="text-[16px] font-semibold text-ink">Send to the landlord</h2>
          <p className="mt-1 text-[12.5px] leading-5 text-slate">
            {landlord.name} will receive a private link to review the inquiry and approve or decline it. No
            account is required.
          </p>
          <Button type="button" className="mt-4" loading={busy === "forward"} onClick={forward} disabled={busy !== null}>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            Forward to landlord
          </Button>
        </section>
      ) : null}

      {inquiry.status === "LANDLORD_REVIEW" ? (
        <section className="rounded-card border border-hairline bg-surface p-6 sm:p-7">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold text-ink">
            <CalendarClock className="h-4 w-4 text-brand-600" aria-hidden="true" />
            Waiting for the landlord
          </h2>
          <p className="mt-1 text-[12.5px] leading-5 text-slate">
            {landlord.name} received the review link
            {inquiry.forwarded_at ? ` on ${formatDate(inquiry.forwarded_at)}` : ""}. The link expires automatically.
            You can monitor the decision on this page.
          </p>
        </section>
      ) : null}

      {inquiry.status === "LANDLORD_APPROVED" ? (
        <section className="rounded-card border border-hairline bg-surface p-6 sm:p-7">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold text-ink">
            <CheckCircle2 className="h-4 w-4 text-success-text" aria-hidden="true" />
            Landlord approved
          </h2>
          <p className="mt-1 text-[12.5px] leading-5 text-slate">
            Prepare the tenancy agreement from a precedent. It is prefilled with the property, rent and parties,
            then sent to the tenant, guarantor and landlord in that order.
          </p>
          {agreement ? (
            <Link href={`/app/documents/${agreement.document_id}`} className={buttonStyles("primary", "sm", "mt-4")}>
              Open the agreement
            </Link>
          ) : (
            <Button type="button" className="mt-4" onClick={() => setAgreementOpen(true)}>
              <FileSignature className="h-4 w-4" aria-hidden="true" />
              Prepare agreement
            </Button>
          )}
        </section>
      ) : null}

      {inquiry.status === "AGREEMENT_CREATED" && agreement ? (
        <section className="rounded-card border border-hairline bg-surface p-6 sm:p-7">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold text-ink">
            <FileSignature className="h-4 w-4 text-brand-600" aria-hidden="true" />
            Agreement in signing
          </h2>
          <p className="mt-1 text-[12.5px] leading-5 text-slate">
            Signing order: tenant, then guarantor (if included), then landlord. Each signer is invited after the
            previous signatures are complete.
          </p>
          <Link href={`/app/documents/${agreement.document_id}`} className={buttonStyles("primary", "sm", "mt-4")}>
            Open the agreement
          </Link>
        </section>
      ) : null}

      {inquiry.status === "DECLINED" || inquiry.status === "LANDLORD_DECLINED" ? (
        <section className="rounded-card border border-hairline bg-surface p-6 sm:p-7">
          <h2 className="text-[16px] font-semibold text-ink">Declined</h2>
          <p className="mt-1 text-[12.5px] leading-5 text-slate">
            {inquiry.status === "DECLINED"
              ? "This inquiry was not forwarded to the landlord."
              : "The landlord declined this inquiry at this stage."}
          </p>
          {inquiry.landlord_comment ? (
            <p className="mt-3 rounded-lg border border-hairline bg-card px-4 py-3 text-[13px] text-slate">
              Landlord comment: {inquiry.landlord_comment}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-card border border-hairline bg-surface p-6 sm:p-7">
            <h2 className="text-[16px] font-semibold text-ink">Applicant</h2>
            <dl className="mt-4 grid gap-4 text-[13px] sm:grid-cols-2">
              <Item label="Full name" value={inquiry.applicant_name} />
              <Item label="Email" value={inquiry.applicant_email} />
              <Item label="Phone" value={inquiry.applicant_phone || "Not provided"} />
              <Item label="Current address" value={inquiry.current_address || "Not provided"} />
              <Item label="Reason for moving" value={inquiry.reason_for_moving || "Not provided"} />
              <Item label="Marital status" value={inquiry.marital_status || "Not provided"} />
              {inquiry.marital_status === "Single" ? (
                <Item label="Dependents" value={inquiry.dependents_count === null ? "Not provided" : String(inquiry.dependents_count)} />
              ) : (
                <>
                  <Item label="Children" value={inquiry.children_count === null ? "Not provided" : String(inquiry.children_count)} />
                  <Item label="Dependents" value={inquiry.dependents_count === null ? "Not provided" : String(inquiry.dependents_count)} />
                </>
              )}
              <Item label="Employment" value={inquiry.employment_status || "Not provided"} />
              <Item label="Employer" value={inquiry.employer || "Not provided"} />
              <Item label="Occupation" value={inquiry.occupation || "Not provided"} />
              <Item label="Employment address" value={inquiry.employment_address || "Not provided"} />
              <Item label="Income range" value={inquiry.income_range || "Not provided"} />
              <Item
                label="Unit requested"
                value={unit ? `Unit ${unit.unit_number} · ${unit.unit_type}` : "Whole property"}
              />
              <Item label="Bedrooms required" value={inquiry.bedrooms_required === null ? "Not provided" : String(inquiry.bedrooms_required)} />
              <Item label="Occupants in compound" value={inquiry.occupants_count === null ? "Not provided" : String(inquiry.occupants_count)} />
              <Item label="State of origin" value={inquiry.state_of_origin || inquiry.religion_state || "Not provided"} />
              <Item label="Typed signature" value={inquiry.signature_name || "Not signed"} />
              <Item
                label="Declaration"
                value={inquiry.declaration_accepted === 1 ? "Accepted on submission" : "Not accepted"}
              />
            </dl>
            {inquiry.additional_info ? (
              <div className="mt-4 rounded-lg border border-hairline bg-card px-4 py-3">
                <p className="text-[12px] font-medium text-slate">Additional information</p>
                <p className="mt-1 whitespace-pre-line text-[13px] leading-6 text-ink">{inquiry.additional_info}</p>
              </div>
            ) : null}
            {inquiry.notes ? (
              <div className="mt-4 rounded-lg border border-hairline bg-card px-4 py-3">
                <p className="text-[12px] font-medium text-slate">Applicant notes</p>
                <p className="mt-1 whitespace-pre-line text-[13px] leading-6 text-ink">{inquiry.notes}</p>
              </div>
            ) : null}
            {inquiry.lawyer_note ? (
              <div className="mt-4 rounded-lg border border-hairline bg-surface-subtle px-4 py-3">
                <p className="text-[12px] font-medium text-slate">Internal note</p>
                <p className="mt-1 whitespace-pre-line text-[13px] leading-6 text-ink">{inquiry.lawyer_note}</p>
              </div>
            ) : null}
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-hairline bg-warning-bg px-4 py-3 text-[12px] leading-5 text-gold-text">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              These details are self-reported. Juripass does not verify identity, income or employment automatically.
            </p>
          </section>

          <section className="rounded-card border border-hairline bg-surface p-6 sm:p-7">
            <h2 className="text-[16px] font-semibold text-ink">Guarantors</h2>
            {guarantors.length === 0 ? (
              <p className="mt-2 text-[13px] text-slate">No guarantor was added to this inquiry.</p>
            ) : (
              <ul className="mt-4 divide-y divide-hairline">
                {guarantors.map((guarantor) => (
                  <li key={guarantor.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[13px]">
                    <div>
                      <p className="font-medium text-ink">{guarantor.name}</p>
                      <p className="text-[12px] text-slate">{guarantor.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-slate">{guarantor.relationship}</span>
                      <Badge tone={guarantor.status === "SIGNED" ? "success" : "neutral"}>{guarantor.status.toLowerCase()}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {files.length > 0 ? (
            <section className="rounded-card border border-hairline bg-surface p-6 sm:p-7">
              <h2 className="text-[16px] font-semibold text-ink">Attached documents</h2>
              <ul className="mt-4 space-y-2">
                {files.map((file) => (
                  <li key={file.id}>
                    <a
                      href={`/api/tenancy/inquiries/${inquiry.id}/files/${file.id}`}
                      download={file.original_filename}
                      className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-card px-4 py-3 text-[13px] hover:border-brand-500"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        {file.mime.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/tenancy/inquiries/${inquiry.id}/files/${file.id}`}
                            alt={file.kind === "passport_photo" ? "Passport photograph" : file.original_filename}
                            className="h-12 w-12 shrink-0 rounded border border-hairline bg-white object-cover"
                          />
                        ) : (
                          <FileText className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-ink">
                            {file.kind === "passport_photo" ? "Passport photograph" : file.original_filename}
                          </span>
                          {file.kind === "passport_photo" ? (
                            <span className="block truncate text-[11px] text-slate">{file.original_filename}</span>
                          ) : null}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-[11.5px] text-slate">
                        {formatBytes(file.bytes)}
                        <span className="font-medium text-brand-600">Download</span>
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11.5px] leading-5 text-slate">
                Files are served privately through the workspace and are never exposed as public storage URLs.
              </p>
            </section>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className="rounded-card border border-hairline bg-surface p-6 sm:p-7">
            <h2 className="text-[16px] font-semibold text-ink">Property</h2>
            <div className="mt-3 space-y-1">
              <p className="text-[14px] font-semibold text-ink">{property.name}</p>
              <p className="text-[12.5px] text-slate">{property.reference}</p>
              <p className="text-[12.5px] text-slate">{property.address}</p>
              {unit ? (
                <p className="text-[12.5px] text-slate">
                  Unit {unit.unit_number} · {unit.unit_type} · {unit.bedrooms} bed
                </p>
              ) : (
                <p className="text-[12.5px] text-slate">
                  Whole property · {property.bedrooms} bed · {property.bathrooms} bath
                </p>
              )}
              <p className="text-[12.5px] text-slate">
                {property.listingType === "part" ? "Part of building" : "Entire property"}
              </p>
              <p className="text-[12.5px] text-slate">
                {formatMoney(unit?.rent_amount_cents || property.rentAmountCents)} per month
              </p>
            </div>
            <div className="mt-4 border-t border-hairline pt-4">
              <p className="text-[12px] font-medium text-slate">Inquiry fee</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ink">
                {feeCents > 0 ? formatMoney(feeCents) : "No fee"}
                {inquiry.status !== "DRAFT" ? (
                  <Badge
                    tone={
                      inquiry.payment_status === "paid"
                        ? "success"
                        : inquiry.payment_status === "failed"
                          ? "danger"
                          : "gold"
                    }
                  >
                    {paymentLabel}
                  </Badge>
                ) : null}
              </p>
              {inquiry.status === "DRAFT" ? (
                <p className="mt-1 text-[11.5px] leading-5 text-slate">
                  Property default: {formatMoney(property.defaultInquiryFeeCents)}. Use Edit to change the
                  fee or waive it before the tenant submits.
                </p>
              ) : null}
              {inquiry.paid_at ? (
                <p className="mt-1 text-[11.5px] text-slate">Paid {formatDate(inquiry.paid_at)}</p>
              ) : null}
              {inquiry.payment_reference ? (
                <p className="mt-1 break-all text-[11.5px] text-slate">Reference {inquiry.payment_reference}</p>
              ) : null}
            </div>
            <div className="mt-4 border-t border-hairline pt-4">
              <p className="text-[12px] font-medium text-slate">Landlord</p>
              <p className="mt-1 flex items-center gap-2 text-[13px] text-ink">
                <UserRound className="h-3.5 w-3.5 text-slate" aria-hidden="true" />
                {landlord.name}
              </p>
              <p className="mt-0.5 break-all text-[12px] text-slate">{landlord.email}</p>
              {landlord.phone ? <p className="text-[12px] text-slate">{landlord.phone}</p> : null}
            </div>
            <Link href={`/app/properties`} className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-text hover:underline">
              Manage properties <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </section>

          <section className="rounded-card border border-hairline bg-surface p-6 sm:p-7">
            <h2 className="text-[16px] font-semibold text-ink">Activity</h2>
            {events.length === 0 ? (
              <p className="mt-2 text-[13px] text-slate">No activity recorded yet.</p>
            ) : (
              <ol className="mt-4 space-y-4">
                {events
                  .slice()
                  .reverse()
                  .map((event) => (
                    <li key={event.id} className="relative border-l border-hairline pl-4">
                      <span className="absolute -left-[3px] top-1.5 h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden="true" />
                      <p className="text-[12.5px] font-medium text-ink">
                        {INQUIRY_EVENT_LABELS[event.event_type] ?? event.event_type}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-slate">
                        {formatDateTime(event.at)}
                        {event.actor_label ? ` · ${event.actor_label}` : ""}
                      </p>
                      {commentFromMetadata(event.metadata_json) ? (
                        <p className="mt-1 text-[12px] leading-5 text-slate">{commentFromMetadata(event.metadata_json)}</p>
                      ) : null}
                    </li>
                  ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      <Modal
        open={agreementOpen}
        onClose={() => setAgreementOpen(false)}
        title="Prepare tenancy agreement"
        description="Choose a precedent and the tenancy dates. The agreement is created as a draft document with signing fields."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAgreementOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="agreement-form" loading={agreementSaving}>
              Prepare agreement
            </Button>
          </div>
        }
      >
        <form id="agreement-form" onSubmit={createAgreement} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Precedent" htmlFor="agreement-precedent" required className="sm:col-span-2">
            <Select
              id="agreement-precedent"
              value={agreementForm.precedentId}
              onChange={(event) => setAgreementForm((current) => ({ ...current, precedentId: event.target.value }))}
              required
            >
              {precedents.map((precedent) => (
                <option key={precedent.id} value={precedent.id}>
                  {precedent.title} — {precedent.category}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Start date" htmlFor="agreement-start" required>
            <Input
              id="agreement-start"
              type="date"
              value={agreementForm.startDate}
              onChange={(event) => setAgreementForm((current) => ({ ...current, startDate: event.target.value }))}
              required
            />
          </FormField>
          <FormField label="End date" htmlFor="agreement-end" required>
            <Input
              id="agreement-end"
              type="date"
              value={agreementForm.endDate}
              onChange={(event) => setAgreementForm((current) => ({ ...current, endDate: event.target.value }))}
              required
            />
          </FormField>
          <div className="rounded-lg border border-hairline bg-surface-subtle px-4 py-3 text-[12px] leading-5 text-slate sm:col-span-2">
            <p>
              Monthly rent ({formatMoney(unit?.rent_amount_cents || property.rentAmountCents)}), jurisdiction and the
              lawyer signatory are taken from the property, unit and your registration details.
            </p>
            <p className="mt-1">
              The agreement opens in the document editor after it is prepared, prefilled with the tenant, guarantor and
              landlord signing order.
            </p>
          </div>
          <p className="flex items-start gap-2 rounded-lg border border-hairline bg-surface-subtle px-4 py-3 text-[12px] leading-5 text-slate sm:col-span-2">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
            The generated precedent is a working draft, not legal advice. Review jurisdiction-specific terms before
            sending it for signature.
          </p>
          {agreementError ? (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-[13px] text-danger sm:col-span-2">
              {agreementError}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit inquiry"
        description="Correct the applicant details or change the unit before the application moves forward."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="inquiry-edit-form" loading={editSaving}>
              Save changes
            </Button>
          </div>
        }
      >
        <form id="inquiry-edit-form" onSubmit={saveEdit} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Applicant name" htmlFor="edit-name" required>
            <Input
              id="edit-name"
              value={editForm.applicantName}
              onChange={(event) => setEditForm((current) => ({ ...current, applicantName: event.target.value }))}
              required
            />
          </FormField>
          <FormField label="Email" htmlFor="edit-email" required>
            <Input
              id="edit-email"
              type="email"
              value={editForm.applicantEmail}
              onChange={(event) => setEditForm((current) => ({ ...current, applicantEmail: event.target.value }))}
              required
            />
          </FormField>
          <FormField label="Phone" htmlFor="edit-phone" required>
            <Input
              id="edit-phone"
              value={editForm.applicantPhone}
              onChange={(event) => setEditForm((current) => ({ ...current, applicantPhone: event.target.value }))}
              required
            />
          </FormField>
          <FormField label="Unit or flat" htmlFor="edit-unit">
            <Select
              id="edit-unit"
              value={editForm.unitId}
              onChange={(event) => setEditForm((current) => ({ ...current, unitId: event.target.value }))}
            >
              <option value="">Whole property</option>
              {units.map((item) => (
                <option key={item.id} value={item.id}>
                  Unit {item.unit_number} · {item.unit_type}
                </option>
              ))}
            </Select>
          </FormField>
          {inquiry.status === "DRAFT" ? (
            <FormField
              label="Inquiry fee for this client (₦)"
              htmlFor="edit-fee"
              hint={`Property default ${formatMoney(property.defaultInquiryFeeCents)}. Enter 0 to waive the fee.`}
              required
            >
              <Input
                id="edit-fee"
                type="number"
                min={0}
                max={1_000_000}
                step="0.01"
                inputMode="decimal"
                value={editForm.inquiryFee}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, inquiryFee: event.target.value }))
                }
                required
              />
            </FormField>
          ) : null}
          <FormField label="Internal note" htmlFor="edit-note" className="sm:col-span-2">
            <Textarea
              id="edit-note"
              value={editForm.lawyerNote}
              onChange={(event) => setEditForm((current) => ({ ...current, lawyerNote: event.target.value }))}
              maxLength={1000}
            />
          </FormField>
          {editError ? (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-[13px] text-danger sm:col-span-2">
              {editError}
            </p>
          ) : null}
        </form>
      </Modal>
    </div>
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

function nairaInput(cents: number): string {
  return String(Math.round(cents / 100));
}

function commentFromMetadata(raw: string): string | null {  try {
    const parsed = JSON.parse(raw) as { comment?: unknown; note?: unknown };
    if (typeof parsed.comment === "string" && parsed.comment.trim()) return parsed.comment;
    if (typeof parsed.note === "string" && parsed.note.trim()) return parsed.note;
    return null;
  } catch {
    return null;
  }
}
