"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ClipboardList, Layers, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormField, Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiClientError } from "@/lib/client";
import { formatBytes } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type {
  LandlordRow,
  PropertyImage,
  PropertyListingType,
  PropertyListRow,
  PropertyStatus,
  PropertyUnitListRow,
  UnitFileRow,
  UnitOccupancy,
} from "@/lib/tenancy";

const CATEGORIES = ["Residential", "Office", "Retail", "Mixed"];

const TYPE_OPTIONS: Record<string, string[]> = {
  Residential: ["Apartment", "Duplex", "Flat", "Bungalow", "House", "Studio", "One-bedroom", "Two-bedroom", "Three-bedroom", "Other"],
  Office: ["Office space", "Office suite", "Co-working desk", "Floor", "Other"],
  Retail: ["Shop", "Store", "Showroom", "Kiosk", "Other"],
  Mixed: ["Mixed use", "Live-work unit", "Other"],
};

const EMPTY_PROPERTY_FORM = {
  landlordId: "",
  reference: "",
  name: "",
  category: "Residential",
  propertyType: "Apartment",
  listingType: "entire" as PropertyListingType,
  addressLine1: "",
  city: "",
  state: "",
  postalCode: "",
  inquiryFee: "",
  unitCount: "0",
  status: "available" as PropertyStatus,
};

function unitLabelFor(category: string, propertyType: string): { label: string; noun: string } {
  if (category === "Retail" || propertyType === "Shop") {
    return { label: "Number of shoplets", noun: "shoplet" };
  }
  return { label: "Number of units", noun: "unit" };
}

function unitNoun(category: string, propertyType: string, count: number): string {
  const { noun } = unitLabelFor(category, propertyType);
  return count === 1 ? noun : `${noun}s`;
}

function unitRange(values: number[]): string | null {
  const present = values.filter((value) => value > 0);
  if (present.length === 0) return null;
  const min = Math.min(...present);
  const max = Math.max(...present);
  return min === max ? String(min) : `${min}–${max}`;
}

const EMPTY_UNIT_FORM = {
  unitNumber: "",
  unitType: "Standard",
  bedrooms: "1",
  bathrooms: "1",
  toilets: "0",
  occupancyStatus: "available" as UnitOccupancy,
  rent: "",
  description: "",
};

const STATUS_TONE: Record<PropertyStatus, "success" | "gold" | "danger" | "muted"> = {
  available: "success",
  occupied: "gold",
  maintenance: "danger",
  archived: "muted",
};

const OCCUPANCY_TONE: Record<UnitOccupancy, "success" | "gold" | "danger"> = {
  available: "success",
  occupied: "gold",
  maintenance: "danger",
};

const LISTING_TYPE_LABELS: Record<PropertyListingType, string> = {
  entire: "Entire property",
  part: "Part of building",
};

const MAX_UNIT_PHOTOS = 6;
const MAX_UNIT_PHOTO_BYTES = 5 * 1024 * 1024;

function propertyImageUrl(propertyId: string, image: PropertyImage, version: string): string {
  return `/api/tenancy/properties/${propertyId}/image?imageId=${encodeURIComponent(image.id)}&v=${encodeURIComponent(version)}`;
}

export function PropertiesPanel({
  properties,
  landlords,
  units,
}: {
  properties: PropertyListRow[];
  landlords: LandlordRow[];
  units: PropertyUnitListRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyListRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_PROPERTY_FORM, landlordId: landlords[0]?.id ?? "" });
  const [unitsFor, setUnitsFor] = useState<PropertyListRow | null>(null);
  const [unitWizard, setUnitWizard] = useState<{
    propertyId: string;
    propertyName: string;
    count: number;
  } | null>(null);
  const [removingImage, setRemovingImage] = useState(false);

  const unitsByProperty = useMemo(() => {
    const map = new Map<string, PropertyUnitListRow[]>();
    for (const unit of units) {
      const list = map.get(unit.property_id) ?? [];
      list.push(unit);
      map.set(unit.property_id, list);
    }
    return map;
  }, [units]);

  const update = (field: keyof typeof form) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const startCreate = () => {
    setEditingProperty(null);
    setForm({ ...EMPTY_PROPERTY_FORM, landlordId: landlords[0]?.id ?? "" });
    setError(null);
    setPropertyOpen(true);
  };

  const startEdit = (property: PropertyListRow) => {
    setEditingProperty(property);
    setForm({
      landlordId: property.landlord_id,
      reference: property.reference,
      name: property.name,
      category: property.category,
      propertyType: property.property_type,
      listingType: property.listing_type,
      addressLine1: property.address_line1,
      city: property.city,
      state: property.state,
      postalCode: property.postal_code ?? "",
      inquiryFee: property.inquiry_fee_cents > 0 ? (property.inquiry_fee_cents / 100).toString() : "",
      unitCount: "0",
      status: property.status,
    });
    setError(null);
    setPropertyOpen(true);
  };

  const closePropertyModal = () => {
    setPropertyOpen(false);
    setEditingProperty(null);
    setError(null);
  };

  const removeImages = async (property: PropertyListRow) => {
    if (!window.confirm(`Remove all photos from ${property.name}?`)) return;
    setRemovingImage(true);
    try {
      await apiFetch(`/api/tenancy/properties/${property.id}/image`, { method: "DELETE" });
      toast({ title: "Photos removed", description: `${property.name} no longer has photos.` });
      router.refresh();
    } catch (err) {
      toast({
        title: "Photos not removed",
        description: err instanceof ApiClientError ? err.message : "Please try again.",
      });
    } finally {
      setRemovingImage(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const inquiryFee = Number(form.inquiryFee);
    if (!form.landlordId) {
      setError("Choose the landlord for this property.");
      return;
    }
    if (form.name.trim().length < 2) {
      setError("Enter the property name.");
      return;
    }
    if (form.category.trim().length < 2) {
      setError("Enter the property category.");
      return;
    }
    if (form.propertyType.trim().length < 2) {
      setError("Enter the property type.");
      return;
    }
    if (form.addressLine1.trim().length < 3) {
      setError("Enter the street address.");
      return;
    }
    if (!form.city.trim() || !form.state.trim()) {
      setError("Enter the city and state.");
      return;
    }
    if (
      form.inquiryFee !== "" &&
      (!Number.isInteger(inquiryFee) || inquiryFee < 0 || inquiryFee > 1_000_000)
    ) {
      setError("Enter an inquiry fee between ₦0 and ₦1,000,000.");
      return;
    }
    setSaving(true);
    setError(null);
    const unitTotal = Math.max(0, Math.min(100, Math.round(Number(form.unitCount || 0))));
    const payload = {
      landlordId: form.landlordId,
      reference: form.reference.trim() || null,
      name: form.name.trim(),
      category: form.category.trim(),
      propertyType: form.propertyType.trim(),
      listingType: form.listingType,
      addressLine1: form.addressLine1.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      postalCode: form.postalCode.trim() || null,
      inquiryFeeCents:
        Number.isFinite(inquiryFee) && inquiryFee > 0 ? Math.round(inquiryFee * 100) : 0,
      status: form.status,
    };
    try {
      if (editingProperty) {
        await apiFetch(`/api/tenancy/properties/${editingProperty.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast({ title: "Property updated", description: `${form.name} has been saved.` });
        setPropertyOpen(false);
        setEditingProperty(null);
        router.refresh();
      } else {
        const result = await apiFetch<{ property: { id: string; name: string } }>("/api/tenancy/properties", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (unitTotal > 0) {
          const propertyId = result.property.id;
          const propertyName = result.property.name;
          setPropertyOpen(false);
          setForm({ ...EMPTY_PROPERTY_FORM, landlordId: landlords[0]?.id ?? "" });
          setUnitWizard({ propertyId, propertyName, count: unitTotal });
          router.refresh();
          return;
        }
        toast({
          title: "Property added",
          description: `${form.name} is ready for tenant inquiries.`,
        });
        setPropertyOpen(false);
        setForm({ ...EMPTY_PROPERTY_FORM, landlordId: landlords[0]?.id ?? "" });
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "The property could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (property: PropertyListRow) => {
    if (!window.confirm(`Delete ${property.name}? Its units and inquiry drafts will be removed. Signed agreements block deletion.`)) {
      return;
    }
    setDeleting(property.id);
    try {
      await apiFetch(`/api/tenancy/properties/${property.id}`, { method: "DELETE" });
      toast({ title: "Property deleted", description: `${property.name} was removed.` });
      router.refresh();
    } catch (err) {
      toast({
        title: "Property not deleted",
        description: err instanceof ApiClientError ? err.message : "Please try again.",
      });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-slate">
          {properties.length} propert{properties.length === 1 ? "y" : "ies"} · {units.length} unit
          {units.length === 1 ? "" : "s"} · {landlords.length} landlord{landlords.length === 1 ? "" : "s"}
        </p>
        <Button type="button" onClick={startCreate} disabled={landlords.length === 0}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add property
        </Button>
      </div>

      {landlords.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
          title="Add a landlord first"
          description="Every property belongs to a landlord profile. Create the landlord, then add the property and its rent details."
          action={
            <Link href="/app/landlords" className={buttonStyles("primary", "md")}>
              Go to landlords
            </Link>
          }
        />
      ) : properties.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
          title="No properties yet"
          description="Add a property profile so you can send tenant inquiries and prepare tenancy agreements."
          action={
            <Button type="button" onClick={startCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add your first property
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {properties.map((property) => {
            const propertyUnits = unitsByProperty.get(property.id) ?? [];
            const unitRents = propertyUnits
              .map((unit) => unit.rent_amount_cents)
              .filter((rent) => rent > 0);
            const rentFromUnits =
              property.rent_amount_cents === 0 && unitRents.length > 0 ? Math.min(...unitRents) : null;
            const bedroomsLabel =
              property.bedrooms > 0
                ? String(property.bedrooms)
                : unitRange(propertyUnits.map((unit) => unit.bedrooms));
            const bathroomsLabel =
              property.bathrooms > 0
                ? String(property.bathrooms)
                : unitRange(propertyUnits.map((unit) => unit.bathrooms));
            return (
              <article key={property.id} className="flex flex-col rounded-card border border-hairline bg-card p-5">
                {property.images.length > 0 ? (
                  <div className="mb-4 space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={propertyImageUrl(property.id, property.images[0], property.updated_at)}
                      alt={`${property.name} property`}
                      className="h-40 w-full rounded-lg border border-hairline object-cover"
                    />
                    {property.images.length > 1 ? (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {property.images.slice(1).map((image) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={image.id}
                            src={propertyImageUrl(property.id, image, property.updated_at)}
                            alt={`${property.name} photo`}
                            className="h-14 w-20 shrink-0 rounded-md border border-hairline object-cover"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-overline text-slate">
                      {property.reference}
                    </p>
                    <h2 className="mt-1 truncate text-[16px] font-semibold text-ink">{property.name}</h2>
                    <p className="mt-1 text-[12.5px] leading-5 text-slate">
                      {[property.address_line1, property.city, property.state, property.postal_code]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[property.status]}>{property.status}</Badge>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="neutral">{property.category}</Badge>
                  <Badge tone="muted">{property.property_type}</Badge>
                  <Badge tone="muted">{LISTING_TYPE_LABELS[property.listing_type]}</Badge>
                  {property.description ? (
                    <span className="text-[11.5px] text-slate">{property.description}</span>
                  ) : null}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-[12.5px]">
                  <div>
                    <dt className="text-slate">Rent</dt>
                    <dd className="mt-0.5 font-semibold text-ink">
                      {property.rent_amount_cents > 0 ? (
                        <>
                          {formatMoney(property.rent_amount_cents)}
                          <span className="font-normal text-slate"> / year</span>
                        </>
                      ) : rentFromUnits !== null ? (
                        <>
                          <span className="font-normal text-slate">From </span>
                          {formatMoney(rentFromUnits)}
                          <span className="font-normal text-slate"> / year</span>
                        </>
                      ) : (
                        <span className="font-normal text-slate">—</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate">Units</dt>
                    <dd className="mt-0.5 font-semibold text-ink">{propertyUnits.length || property.unit_count}</dd>
                  </div>
                  <div>
                    <dt className="text-slate">Bedrooms</dt>
                    <dd className="mt-0.5 font-semibold text-ink">{bedroomsLabel ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate">Bathrooms</dt>
                    <dd className="mt-0.5 font-semibold text-ink">{bathroomsLabel ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate">Landlord</dt>
                    <dd className="mt-0.5 truncate font-medium text-ink">{property.landlord_name}</dd>
                  </div>
                  <div>
                    <dt className="text-slate">Inquiries</dt>
                    <dd className="mt-0.5 font-semibold text-ink">{property.inquiry_count}</dd>
                  </div>
                  <div>
                    <dt className="text-slate">Inquiry fee</dt>
                    <dd className="mt-0.5 font-semibold text-ink">
                      {property.inquiry_fee_cents > 0 ? formatMoney(property.inquiry_fee_cents) : "None"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href={`/app/inquiries/new?propertyId=${property.id}`} className={buttonStyles("secondary", "sm")}>
                    <ClipboardList className="h-4 w-4" aria-hidden="true" />
                    Send inquiry
                  </Link>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setUnitsFor(property)}>
                    <Layers className="h-4 w-4" aria-hidden="true" />
                    Units
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(property)}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </Button>
                  {property.images.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={removingImage}
                      onClick={() => removeImages(property)}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      Remove photos
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={deleting === property.id}
                    onClick={() => remove(property)}
                    aria-label={`Delete ${property.name}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={propertyOpen}
        onClose={closePropertyModal}
        title={editingProperty ? "Edit property" : "Add property"}
        description="A unique reference is generated automatically. Units keep their own bedrooms, bathrooms, rent and description. The address is prefilled into agreements prepared from this property."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closePropertyModal}>
              Cancel
            </Button>
            <Button type="submit" form="property-form" loading={saving}>
              {editingProperty ? "Save changes" : "Add property"}
            </Button>
          </div>
        }
      >
        <form id="property-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <FormField label="Landlord" htmlFor="property-landlord" required className="sm:col-span-2">
            <Select id="property-landlord" value={form.landlordId} onChange={update("landlordId")} required data-autofocus>
              {landlords.map((landlord) => (
                <option key={landlord.id} value={landlord.id}>
                  {landlord.name} — {landlord.email}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Property name" htmlFor="property-name" required>
            <Input id="property-name" value={form.name} onChange={update("name")} maxLength={120} required />
          </FormField>
          <FormField label="Category" htmlFor="property-category" required>
            <Select
              id="property-category"
              value={form.category}
              onChange={(event) => {
                const category = event.target.value;
                setForm((current) => ({
                  ...current,
                  category,
                  propertyType: TYPE_OPTIONS[category]?.[0] ?? current.propertyType,
                }));
              }}
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Property type" htmlFor="property-type" required>
            <Select id="property-type" value={form.propertyType} onChange={update("propertyType")}>
              {(TYPE_OPTIONS[form.category] ?? TYPE_OPTIONS.Residential).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Listing type"
            htmlFor="property-listing-type"
            required
            hint="Choose whether the whole property or only part of the building is being let."
          >
            <Select
              id="property-listing-type"
              value={form.listingType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  listingType: event.target.value as PropertyListingType,
                }))
              }
            >
              <option value="entire">Entire property</option>
              <option value="part">Part of building</option>
            </Select>
          </FormField>
          <FormField
            label="Inquiry fee"
            htmlFor="property-fee"
            className="sm:col-span-2"
            hint="Optional. Whole numbers only. Applicants pay this fee on Paystack before the inquiry can be reviewed."
          >
            <Input
              id="property-fee"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={form.inquiryFee}
              onChange={update("inquiryFee")}
            />
          </FormField>
          <FormField label="Address" htmlFor="property-address" required className="sm:col-span-2">
            <Input
              id="property-address"
              value={form.addressLine1}
              onChange={update("addressLine1")}
              maxLength={200}
              required
            />
          </FormField>
          <FormField label="City" htmlFor="property-city" required>
            <Input id="property-city" value={form.city} onChange={update("city")} maxLength={80} required />
          </FormField>
          <FormField label="State or region" htmlFor="property-state" required>
            <Input id="property-state" value={form.state} onChange={update("state")} maxLength={80} required />
          </FormField>
          <FormField label="Postal code" htmlFor="property-postal">
            <Input id="property-postal" value={form.postalCode} onChange={update("postalCode")} maxLength={20} />
          </FormField>
          <FormField label="Status" htmlFor="property-status">
            <Select id="property-status" value={form.status} onChange={update("status")}>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
              <option value="archived">Archived</option>
            </Select>
          </FormField>
          {!editingProperty ? (
            <FormField
              label={unitLabelFor(form.category, form.propertyType).label}
              htmlFor="property-units"
              hint={`You will fill in each ${unitNoun(form.category, form.propertyType, 1)} one by one in the next step. Enter 0 if the property has no separate units.`}
              className="sm:col-span-2"
            >
              <Input
                id="property-units"
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                value={form.unitCount}
                onChange={update("unitCount")}
              />
            </FormField>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger sm:col-span-2">
              {error}
            </p>
          ) : null}
        </form>
      </Modal>

      <UnitsModal
        property={unitsFor}
        units={unitsFor ? unitsByProperty.get(unitsFor.id) ?? [] : []}
        onClose={() => setUnitsFor(null)}
        onChanged={() => router.refresh()}
      />

      <UnitSetupWizard
        wizard={unitWizard}
        onClose={() => {
          setUnitWizard(null);
          router.refresh();
        }}
        onFinished={() => {
          setUnitWizard(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function UnitFields({
  form,
  update,
  idPrefix,
}: {
  form: typeof EMPTY_UNIT_FORM;
  update: (field: keyof typeof EMPTY_UNIT_FORM) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField label="Unit name or number" htmlFor={`${idPrefix}-number`} required className="sm:col-span-2">
        <Input
          id={`${idPrefix}-number`}
          value={form.unitNumber}
          onChange={update("unitNumber")}
          maxLength={40}
          required
        />
      </FormField>
      <FormField label="Unit type" htmlFor={`${idPrefix}-type`} required>
        <Input
          id={`${idPrefix}-type`}
          value={form.unitType}
          onChange={update("unitType")}
          maxLength={60}
          required
        />
      </FormField>
      <FormField label="Occupancy" htmlFor={`${idPrefix}-occupancy`}>
        <Select id={`${idPrefix}-occupancy`} value={form.occupancyStatus} onChange={update("occupancyStatus")}>
          <option value="available">Available</option>
          <option value="occupied">Occupied</option>
          <option value="maintenance">Maintenance</option>
        </Select>
      </FormField>
      <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
        <FormField label="Bedrooms" htmlFor={`${idPrefix}-bedrooms`}>
          <Input
            id={`${idPrefix}-bedrooms`}
            type="number"
            min={0}
            max={50}
            step={1}
            inputMode="numeric"
            value={form.bedrooms}
            onChange={update("bedrooms")}
          />
        </FormField>
        <FormField label="Bathrooms" htmlFor={`${idPrefix}-bathrooms`}>
          <Input
            id={`${idPrefix}-bathrooms`}
            type="number"
            min={0}
            max={50}
            step={1}
            inputMode="numeric"
            value={form.bathrooms}
            onChange={update("bathrooms")}
          />
        </FormField>
        <FormField label="Toilets" htmlFor={`${idPrefix}-toilets`}>
          <Input
            id={`${idPrefix}-toilets`}
            type="number"
            min={0}
            max={50}
            step={1}
            inputMode="numeric"
            value={form.toilets}
            onChange={update("toilets")}
          />
        </FormField>
      </div>
      <FormField
        label="Yearly rent (₦)"
        htmlFor={`${idPrefix}-rent`}
        hint="Whole naira amount per year."
        className="sm:col-span-2"
      >
        <Input
          id={`${idPrefix}-rent`}
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={form.rent}
          onChange={update("rent")}
        />
      </FormField>
      <FormField label="Description" htmlFor={`${idPrefix}-description`} className="sm:col-span-2">
        <Textarea
          id={`${idPrefix}-description`}
          value={form.description}
          onChange={update("description")}
          maxLength={1000}
        />
      </FormField>
    </div>
  );
}

function UnitsModal({
  property,
  units,
  onClose,
  onChanged,
}: {
  property: PropertyListRow | null;
  units: PropertyUnitListRow[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_UNIT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof typeof form) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const resetForm = () => {
    setForm(EMPTY_UNIT_FORM);
    setEditingId(null);
    setError(null);
  };

  const editUnit = (unit: PropertyUnitListRow) => {
    setEditingId(unit.id);
    setForm({
      unitNumber: unit.unit_number,
      unitType: unit.unit_type,
      bedrooms: String(unit.bedrooms),
      bathrooms: String(unit.bathrooms ?? 1),
      toilets: String(unit.toilets ?? 0),
      occupancyStatus: unit.occupancy_status,
      rent: (unit.rent_amount_cents / 100).toString(),
      description: unit.description ?? "",
    });
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!property) return;
    const rent = Number(form.rent);
    if (!form.unitNumber.trim()) {
      setError("Enter a unit name or number.");
      return;
    }
    if (form.unitType.trim().length < 2) {
      setError("Enter a unit type, for example Flat, Duplex or Shop.");
      return;
    }
    if (!Number.isInteger(rent) || rent < 0 || rent > 1_000_000) {
      setError("Enter a yearly rent between ₦0 and ₦1,000,000.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      unitNumber: form.unitNumber.trim(),
      unitType: form.unitType.trim(),
      bedrooms: Math.round(Number(form.bedrooms || 0)),
      bathrooms: Math.round(Number(form.bathrooms || 0)),
      toilets: Math.round(Number(form.toilets || 0)),
      occupancyStatus: form.occupancyStatus,
      rentAmountCents: rent * 100,
      description: form.description || null,
    };
    try {
      if (editingId) {
        await apiFetch(`/api/tenancy/units/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast({ title: "Unit updated", description: `Unit ${form.unitNumber} has been saved.` });
        resetForm();
        onChanged();
      } else {
        await apiFetch<{ unit: { id: string } }>("/api/tenancy/units", {
          method: "POST",
          body: JSON.stringify({ propertyId: property.id, ...payload }),
        });
        toast({ title: "Unit added", description: `Unit ${form.unitNumber} is ready.` });
        resetForm();
        onChanged();
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "The unit could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const removeUnit = async (unit: PropertyUnitListRow) => {
    if (!property || !window.confirm(`Delete unit ${unit.unit_number}?`)) return;
    try {
      await apiFetch(`/api/tenancy/units/${unit.id}`, { method: "DELETE" });
      toast({ title: "Unit deleted", description: `Unit ${unit.unit_number} was removed.` });
      onChanged();
    } catch (err) {
      toast({
        title: "Unit not deleted",
        description: err instanceof ApiClientError ? err.message : "Please try again.",
      });
    }
  };

  return (
    <Modal
      open={Boolean(property)}
      onClose={onClose}
      title={property ? `Units · ${property.name}` : "Units"}
      description="Each unit has its own name, rent and occupancy status. Tenant inquiries can target a specific unit."
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {units.length === 0 ? (
          <p className="rounded-lg border border-hairline bg-surface-subtle px-4 py-3 text-[13px] text-slate">
            No units yet. Add one below.
          </p>
        ) : (
          <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
            {units.map((unit) => (
              <li key={unit.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink">
                      Unit {unit.unit_number} · {unit.unit_type}
                    </p>
                    <p className="text-[11.5px] text-slate">
                      {unit.bedrooms} bed · {unit.bathrooms ?? 1} bath · {unit.toilets ?? 0} toilet
                      {(unit.toilets ?? 0) === 1 ? "" : "s"} · {formatMoney(unit.rent_amount_cents)} / year ·{" "}
                      {unit.inquiry_count} inquir
                      {unit.inquiry_count === 1 ? "y" : "ies"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={OCCUPANCY_TONE[unit.occupancy_status]}>{unit.occupancy_status}</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => (editingId === unit.id ? resetForm() : editUnit(unit))}
                      aria-label={`Edit unit ${unit.unit_number}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeUnit(unit)}
                      aria-label={`Delete unit ${unit.unit_number}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                {editingId === unit.id ? (
                  <form
                    onSubmit={submit}
                    className="mt-3 space-y-3 rounded-lg border border-hairline bg-surface-subtle p-4"
                  >
                    <p className="text-[13px] font-semibold text-ink">Edit unit {unit.unit_number}</p>
                    <UnitFields form={form} update={update} idPrefix={`edit-${unit.id}`} />
                    <UnitFiles unitId={unit.id} onChanged={onChanged} />
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" size="sm" loading={saving}>
                        Save unit
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                        Cancel
                      </Button>
                    </div>
                    {error ? (
                      <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-[12.5px] text-danger">
                        {error}
                      </p>
                    ) : null}
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {editingId ? null : (
          <form onSubmit={submit} className="space-y-3 rounded-lg border border-hairline bg-surface-subtle p-4">
            <p className="text-[13px] font-semibold text-ink">Add a unit</p>
            <UnitFields form={form} update={update} idPrefix="unit" />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" loading={saving}>
                Add unit
              </Button>
            </div>
            {error ? (
              <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-[12.5px] text-danger">
                {error}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </Modal>
  );
}

function UnitSetupWizard({
  wizard,
  onClose,
  onFinished,
}: {
  wizard: { propertyId: string; propertyName: string; count: number } | null;
  onClose: () => void;
  onFinished: () => void;
}) {
  const { toast } = useToast();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(0);
  const [form, setForm] = useState(EMPTY_UNIT_FORM);
  const [photos, setPhotos] = useState<Array<{ file: File; url: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(
    () => () => {
      for (const item of photosRef.current) URL.revokeObjectURL(item.url);
    },
    [],
  );

  const clearPhotos = () => {
    setPhotos((current) => {
      for (const item of current) URL.revokeObjectURL(item.url);
      return [];
    });
  };

  useEffect(() => {
    if (wizard) {
      setIndex(0);
      setDone(0);
      setForm({ ...EMPTY_UNIT_FORM, unitNumber: wizard.count > 1 ? "Flat-1" : "1" });
      setPhotos((current) => {
        for (const item of current) URL.revokeObjectURL(item.url);
        return [];
      });
      setError(null);
    }
  }, [wizard]);

  const update = (field: keyof typeof form) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const pickPhotos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const room = MAX_UNIT_PHOTOS - photos.length;
    if (room <= 0) {
      setError(`A unit can have up to ${MAX_UNIT_PHOTOS} photos.`);
      return;
    }
    const accepted: Array<{ file: File; url: string }> = [];
    for (const file of Array.from(files).slice(0, room)) {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        setError("Upload PNG, JPEG or WebP images only.");
        continue;
      }
      if (file.size > MAX_UNIT_PHOTO_BYTES) {
        setError("Each image must be 5 MB or smaller.");
        continue;
      }
      accepted.push({ file, url: URL.createObjectURL(file) });
    }
    if (accepted.length) setPhotos((current) => [...current, ...accepted]);
  };

  const removePhoto = (photoIndex: number) => {
    setPhotos((current) => {
      const target = current[photoIndex];
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((_, itemIndex) => itemIndex !== photoIndex);
    });
  };

  const submitStep = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!wizard) return;
    const rent = Number(form.rent);
    if (!form.unitNumber.trim()) {
      setError("Enter a unit name or number.");
      return;
    }
    if (form.unitType.trim().length < 2) {
      setError("Enter a unit type, for example Flat, Duplex or Shop.");
      return;
    }
    if (!Number.isInteger(rent) || rent < 0 || rent > 1_000_000) {
      setError("Enter a yearly rent between ₦0 and ₦1,000,000.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await apiFetch<{ unit: { id: string } }>("/api/tenancy/units", {
        method: "POST",
        body: JSON.stringify({
          propertyId: wizard.propertyId,
          unitNumber: form.unitNumber.trim(),
          unitType: form.unitType.trim(),
          bedrooms: Math.round(Number(form.bedrooms || 0)),
          bathrooms: Math.round(Number(form.bathrooms || 0)),
          toilets: Math.round(Number(form.toilets || 0)),
          occupancyStatus: form.occupancyStatus,
          rentAmountCents: rent * 100,
          description: form.description || null,
        }),
      });
      let failedPhotos = 0;
      for (const item of photos) {
        const body = new FormData();
        body.set("file", item.file);
        try {
          await apiFetch(`/api/tenancy/units/${created.unit.id}/files`, { method: "POST", body });
        } catch {
          failedPhotos += 1;
        }
      }
      if (failedPhotos > 0) {
        toast({
          title: "Photos not saved",
          description: `${failedPhotos} of ${photos.length} photo${photos.length === 1 ? "" : "s"} could not be uploaded. The unit itself was saved.`,
        });
      }
      clearPhotos();
      const nextDone = done + 1;
      setDone(nextDone);
      if (nextDone >= wizard.count) {
        toast({
          title: "Property added",
          description: `${wizard.propertyName} and ${wizard.count} ${wizard.count === 1 ? "unit" : "units"} are ready.`,
        });
        onFinished();
      } else {
        setForm({
          ...EMPTY_UNIT_FORM,
          unitNumber: wizard.count > 1 ? `Flat-${nextDone + 1}` : String(nextDone + 1),
        });
        setIndex(nextDone);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "The unit could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const step = wizard ? Math.min(index, wizard.count - 1) : 0;

  return (
    <Modal
      open={Boolean(wizard)}
      onClose={onClose}
      title={wizard ? `Set up units · ${wizard.propertyName}` : "Set up units"}
      description={
        wizard
          ? `Unit ${step + 1} of ${wizard.count}. Each unit is saved as you go — finish the rest later from the property's Units panel if you need to.`
          : undefined
      }
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Finish later
          </Button>
          <Button type="submit" form="unit-wizard-form" loading={saving}>
            {wizard && step + 1 >= wizard.count ? "Save and finish" : "Save and continue"}
          </Button>
        </div>
      }
    >
      {wizard ? (
        <div className="mb-4 flex items-center gap-1.5">
          {Array.from({ length: wizard.count }, (_, itemIndex) => (
            <span
              key={itemIndex}
              className={`h-1.5 flex-1 rounded-full ${
                itemIndex < done ? "bg-brand-600" : itemIndex === step ? "bg-brand-300" : "bg-hairline"
              }`}
            />
          ))}
        </div>
      ) : null}
      <form id="unit-wizard-form" onSubmit={submitStep} className="space-y-4">
        <UnitFields form={form} update={update} idPrefix="wizard" />
        <FormField
          label="Photos for this unit"
          htmlFor="wizard-photos"
          hint={`Optional. Add up to ${MAX_UNIT_PHOTOS} photos. PNG, JPEG or WebP up to 5 MB each.`}
        >
          <div className="rounded-xl border border-dashed border-hairline-strong bg-surface-subtle p-4">
            {photos.length > 0 ? (
              <div className="mb-3 grid grid-cols-3 gap-2">
                {photos.map((item, photoIndex) => (
                  <div key={item.url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.file.name}
                      className="h-20 w-full rounded-lg border border-hairline object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(photoIndex)}
                      aria-label="Remove photo"
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-white hover:bg-ink"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-[12px] text-slate">No photos selected</p>
            )}
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-hairline bg-card px-3 py-1.5 text-[12px] font-medium text-ink hover:border-brand-500">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              {photos.length > 0 ? "Add more photos" : "Browse photos"}
              <input
                id="wizard-photos"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="sr-only"
                onChange={(event) => {
                  pickPhotos(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        </FormField>
        {error ? (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

function UnitFiles({ unitId, onChanged }: { unitId: string; onChanged: () => void }) {
  const { toast } = useToast();
  const [files, setFiles] = useState<UnitFileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch<{ files: UnitFileRow[] }>(`/api/tenancy/units/${unitId}/files`)
      .then((result) => {
        if (!cancelled) setFiles(result.files);
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  const upload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const result = await apiFetch<{ file: UnitFileRow }>(`/api/tenancy/units/${unitId}/files`, {
        method: "POST",
        body,
      });
      setFiles((current) => [...current, result.file]);
      onChanged();
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof ApiClientError ? err.message : "Please try again.",
      });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (file: UnitFileRow) => {
    if (!window.confirm(`Delete ${file.original_filename}?`)) return;
    try {
      await apiFetch(`/api/tenancy/units/${unitId}/files/${file.id}`, { method: "DELETE" });
      setFiles((current) => current.filter((item) => item.id !== file.id));
      onChanged();
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof ApiClientError ? err.message : "Please try again.",
      });
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-hairline bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-ink">Images and documents</p>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-medium text-brand-text hover:underline">
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          {uploading ? "Uploading…" : "Upload"}
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              void upload(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {loading ? (
        <p className="text-[11.5px] text-slate">Loading files…</p>
      ) : files.length === 0 ? (
        <p className="text-[11.5px] text-slate">No files attached to this unit.</p>
      ) : (
        <ul className="space-y-1.5">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-2 text-[12px]">
              <a
                href={`/api/tenancy/units/${unitId}/files/${file.id}`}
                className="min-w-0 flex-1 truncate text-ink hover:underline"
              >
                {file.original_filename}
              </a>
              <span className="text-[11px] text-slate">{formatBytes(file.bytes)}</span>
              <button type="button" onClick={() => remove(file)} className="text-slate hover:text-danger" aria-label={`Delete ${file.original_filename}`}>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
