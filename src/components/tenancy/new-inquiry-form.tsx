"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { FormField, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiClientError } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import type { PropertyListRow, PropertyUnitListRow } from "@/lib/tenancy";

export function NewInquiryForm({
  properties,
  units,
  initialPropertyId,
}: {
  properties: PropertyListRow[];
  units: PropertyUnitListRow[];
  initialPropertyId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const initialProperty =
    properties.find((property) => property.id === initialPropertyId) ?? properties[0];
  const [form, setForm] = useState({
    propertyId: initialProperty?.id ?? "",
    unitId: "",
    applicantName: "",
    applicantEmail: "",
    applicantPhone: "",
    lawyerNote: "",
    inquiryFee: nairaInput(initialProperty?.inquiry_fee_cents ?? 0),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof typeof form) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const selected = properties.find((property) => property.id === form.propertyId);
  const propertyUnits = units.filter((unit) => unit.property_id === form.propertyId);
  const selectedUnit = propertyUnits.find((unit) => unit.id === form.unitId) ?? null;

  const selectProperty = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = properties.find((property) => property.id === event.target.value);
    setForm((current) => ({
      ...current,
      propertyId: event.target.value,
      unitId: "",
      inquiryFee: nairaInput(next?.inquiry_fee_cents ?? 0),
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const feeNaira = Number(form.inquiryFee);
    if (!Number.isFinite(feeNaira) || feeNaira < 0 || feeNaira > 1_000_000) {
      setError("Enter an inquiry fee between ₦0 and ₦1,000,000.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch<{ inquiry: { id: string }; demoLink?: string }>(
        "/api/tenancy/inquiries",
        {
          method: "POST",
          body: JSON.stringify({
            propertyId: form.propertyId,
            unitId: form.unitId || null,
            applicantName: form.applicantName,
            applicantEmail: form.applicantEmail,
            applicantPhone: form.applicantPhone,
            lawyerNote: form.lawyerNote || null,
            inquiryFeeCents: Math.round(feeNaira * 100),
          }),
        },
      );
      toast({
        title: "Inquiry link sent",
        description: "The tenant can now complete the form from the private link.",
      });
      router.push(`/app/inquiries/${result.inquiry.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "The inquiry could not be created.");
    } finally {
      setSaving(false);
    }
  };

  if (properties.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-hairline-strong bg-surface px-6 py-14 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-slate">
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-serif text-[22px] leading-7 text-ink">Add a property first</h2>
        <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-6 text-slate">
          An inquiry is always linked to a property and its landlord. Add the landlord and property
          profile, then return here to send the form.
        </p>
        <Link href="/app/properties" className={buttonStyles("primary", "md", "mt-5")}>
          Go to properties
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <section className="space-y-4 rounded-card border border-hairline bg-surface p-6 sm:p-7">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Property</h2>
          <p className="mt-1 text-[12.5px] text-slate">
            The tenant sees the property details and landlord contact is kept private until review.
          </p>
        </div>
        <FormField label="Property" htmlFor="inquiry-property" required>
          <Select id="inquiry-property" value={form.propertyId} onChange={selectProperty} required data-autofocus>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name} ({property.reference}) — {property.landlord_name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Unit or flat"
          htmlFor="inquiry-unit"
          hint="Optional. Choose the specific unit when the property has several."
        >
          <Select id="inquiry-unit" value={form.unitId} onChange={update("unitId")}>
            <option value="">Whole property</option>
            {propertyUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                Unit {unit.unit_number} · {unit.unit_type}
                {unit.occupancy_status === "occupied" ? " (occupied)" : ""}
              </option>
            ))}
          </Select>
        </FormField>
        {selected ? (
          <p className="rounded-lg border border-hairline bg-card px-4 py-3 text-[12.5px] leading-5 text-slate">
            {[selected.address_line1, selected.city, selected.state].filter(Boolean).join(", ")} ·{" "}
            {selected.category} · {selected.property_type} ·{" "}
            {selected.listing_type === "part" ? "Part of building" : "Entire property"} ·{" "}
            {selectedUnit
              ? `Unit ${selectedUnit.unit_number} · ${selectedUnit.bedrooms} bed · ${formatMoney(selectedUnit.rent_amount_cents)} per month`
              : `${selected.bedrooms} bedroom${selected.bedrooms === 1 ? "" : "s"} · ${selected.bathrooms} bathroom${selected.bathrooms === 1 ? "" : "s"} · ${formatMoney(selected.rent_amount_cents)} per month`}
          </p>
        ) : null}
        <FormField
          label="Inquiry fee for this client (₦)"
          htmlFor="inquiry-fee"
          hint={
            selected
              ? `Default is ${formatMoney(selected.inquiry_fee_cents)}, set on the property. Change it for this client, or enter 0 to waive the fee.`
              : "Defaults to the property's inquiry fee. Enter 0 to waive the fee."
          }
          required
        >
          <Input
            id="inquiry-fee"
            type="number"
            min={0}
            max={1_000_000}
            step="0.01"
            inputMode="decimal"
            value={form.inquiryFee}
            onChange={update("inquiryFee")}
            required
          />
        </FormField>
      </section>

      <section className="space-y-4 rounded-card border border-hairline bg-surface p-6 sm:p-7">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Tenant</h2>
          <p className="mt-1 text-[12.5px] text-slate">
            We email a private form to this person. It expires automatically and can only be submitted once.
          </p>
        </div>
        <FormField label="Full name" htmlFor="inquiry-name" required>
          <Input id="inquiry-name" value={form.applicantName} onChange={update("applicantName")} required />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Email" htmlFor="inquiry-email" required>
            <Input id="inquiry-email" type="email" value={form.applicantEmail} onChange={update("applicantEmail")} required />
          </FormField>
          <FormField label="Phone" htmlFor="inquiry-phone" required>
            <Input id="inquiry-phone" value={form.applicantPhone} onChange={update("applicantPhone")} required />
          </FormField>
        </div>
        <FormField
          label="Internal note"
          htmlFor="inquiry-note"
          hint="Optional. Visible to your workspace only, not to the tenant."
        >
          <Textarea id="inquiry-note" value={form.lawyerNote} onChange={update("lawyerNote")} maxLength={1000} />
        </FormField>
      </section>

      {error ? (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={saving}>
          Send inquiry form
        </Button>
        <Link href="/app/inquiries" className={buttonStyles("ghost", "md")}>
          Cancel
        </Link>
        <p className="text-[12px] text-slate">The tenant gets a private link. No account is required.</p>
      </div>
    </form>
  );
}

function nairaInput(cents: number): string {
  return String(Math.round(cents / 100));
}
