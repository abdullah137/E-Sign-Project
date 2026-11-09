"use client";

import { useEffect, useMemo, useState } from "react";
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
  description: "",
  addressLine1: "",
  city: "",
  state: "",
  postalCode: "",
  bedrooms: "2",
  rent: "",
  inquiryFee: "",
  unitCount: "0",
  status: "available" as PropertyStatus,
};

function unitLabelFor(category: string, propertyType: string): { label: string; noun: string } {
  if (category === "Retail" || propertyType === "Shop") {
    return { label: "Number of shoplets", noun: "shoplet" };
  }
  if (category === "Residential") {
    return { label: "Number of rooms", noun: "room" };
  }
  return { label: "Number of units", noun: "unit" };
}

function unitNoun(category: string, propertyType: string, count: number): string {
  const { noun } = unitLabelFor(category, propertyType);
  return count === 1 ? noun : `${noun}s`;
}

const EMPTY_UNIT_FORM = {
  unitNumber: "",
  unitType: "Standard",
  bedrooms: "1",
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removingImage, setRemovingImage] = useState(false);

  useEffect(
    () => () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    },
    [imagePreview],
  );

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
    setImageFile(null);
    setImagePreview(null);
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
      description: property.description ?? "",
      addressLine1: property.address_line1,
      city: property.city,
      state: property.state,
      postalCode: property.postal_code ?? "",
      bedrooms: String(property.bedrooms),
      rent: (property.rent_amount_cents / 100).toString(),
      inquiryFee: property.inquiry_fee_cents > 0 ? (property.inquiry_fee_cents / 100).toString() : "",
      unitCount: "0",
      status: property.status,
    });
    setImageFile(null);
    setImagePreview(null);
    setError(null);
    setPropertyOpen(true);
  };

  const pickImage = (file: File | null) => {
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const uploadImage = async (propertyId: string) => {
    if (!imageFile) return;
    const body = new FormData();
    body.set("image", imageFile);
    await apiFetch(`/api/tenancy/properties/${propertyId}/image`, { method: "POST", body });
  };

  const removeImage = async (property: PropertyListRow) => {
    if (!window.confirm(`Remove the image from ${property.name}?`)) return;
    setRemovingImage(true);
    try {
      await apiFetch(`/api/tenancy/properties/${property.id}/image`, { method: "DELETE" });
      toast({ title: "Image removed", description: `${property.name} no longer has a photo.` });
      router.refresh();
    } catch (err) {
      toast({
        title: "Image not removed",
        description: err instanceof ApiClientError ? err.message : "Please try again.",
      });
    } finally {
      setRemovingImage(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const rentAmount = Number(form.rent);
    const inquiryFee = Number(form.inquiryFee);
    const payload = {
      landlordId: form.landlordId,
      reference: form.reference || null,
      name: form.name,
      category: form.category,
      propertyType: form.propertyType,
      description: form.description || null,
      addressLine1: form.addressLine1,
      city: form.city,
      state: form.state,
      postalCode: form.postalCode || null,
      bedrooms: Number(form.bedrooms || 0),
      rentAmountCents: Number.isFinite(rentAmount) ? Math.round(rentAmount * 100) : 0,
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
        await uploadImage(editingProperty.id);
        toast({ title: "Property updated", description: `${form.name} has been saved.` });
        setPropertyOpen(false);
        setEditingProperty(null);
        setImageFile(null);
        setImagePreview(null);
        router.refresh();
      } else {
        const result = await apiFetch<{ property: { id: string; name: string } }>("/api/tenancy/properties", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        await uploadImage(result.property.id);
        const count = Math.max(0, Math.min(100, Math.round(Number(form.unitCount || 0))));
        if (count > 0) {
          await apiFetch("/api/tenancy/units", {
            method: "POST",
            body: JSON.stringify({
              propertyId: result.property.id,
              units: Array.from({ length: count }, (_, index) => ({
                unitNumber: String(index + 1),
                unitType: form.propertyType,
                bedrooms: Number(form.bedrooms || 0),
                occupancyStatus: "available",
                rentAmountCents: payload.rentAmountCents,
                description: null,
              })),
            }),
          });
        }
        toast({
          title: "Property added",
          description:
            count > 0
              ? `${form.name} and ${count} ${unitNoun(form.category, form.propertyType, count)} are ready.`
              : `${form.name} is ready for tenant inquiries.`,
        });
        setPropertyOpen(false);
        setForm({ ...EMPTY_PROPERTY_FORM, landlordId: landlords[0]?.id ?? "" });
        setImageFile(null);
        setImagePreview(null);
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
            return (
              <article key={property.id} className="flex flex-col rounded-card border border-hairline bg-card p-5">
                {property.image_storage_key ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/tenancy/properties/${property.id}/image?v=${encodeURIComponent(property.updated_at)}`}
                    alt={`${property.name} property`}
                    className="mb-4 h-40 w-full rounded-lg border border-hairline object-cover"
                  />
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
                  {property.description ? (
                    <span className="text-[11.5px] text-slate">{property.description}</span>
                  ) : null}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-[12.5px]">
                  <div>
                    <dt className="text-slate">Rent</dt>
                    <dd className="mt-0.5 font-semibold text-ink">
                      {formatMoney(property.rent_amount_cents)}
                      <span className="font-normal text-slate"> / month</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate">Units</dt>
                    <dd className="mt-0.5 font-semibold text-ink">{propertyUnits.length || property.unit_count}</dd>
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
                  {property.image_storage_key ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={removingImage}
                      onClick={() => removeImage(property)}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      Remove photo
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
        onClose={() => setPropertyOpen(false)}
        title={editingProperty ? "Edit property" : "Add property"}
        description="A unique reference is generated automatically. The rent and address are prefilled into agreements prepared from this property."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPropertyOpen(false)}>
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
            <Input id="property-name" value={form.name} onChange={update("name")} required />
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
            label="Inquiry fee"
            htmlFor="property-fee"
            hint="Optional. Applicants pay this fee on Paystack before the inquiry can be reviewed."
          >
            <Input
              id="property-fee"
              type="number"
              min={0}
              step="0.01"
              value={form.inquiryFee}
              onChange={update("inquiryFee")}
            />
          </FormField>
          <FormField label="Address" htmlFor="property-address" required className="sm:col-span-2">
            <Input id="property-address" value={form.addressLine1} onChange={update("addressLine1")} required />
          </FormField>
          <FormField label="City" htmlFor="property-city" required>
            <Input id="property-city" value={form.city} onChange={update("city")} required />
          </FormField>
          <FormField label="State or region" htmlFor="property-state" required>
            <Input id="property-state" value={form.state} onChange={update("state")} required />
          </FormField>
          <FormField label="Postal code" htmlFor="property-postal">
            <Input id="property-postal" value={form.postalCode} onChange={update("postalCode")} />
          </FormField>
          <FormField label="Status" htmlFor="property-status">
            <Select id="property-status" value={form.status} onChange={update("status")}>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
              <option value="archived">Archived</option>
            </Select>
          </FormField>
          <FormField label="Bedrooms" htmlFor="property-bedrooms">
            <Input id="property-bedrooms" type="number" min={0} max={50} value={form.bedrooms} onChange={update("bedrooms")} />
          </FormField>
          <FormField label="Monthly rent" htmlFor="property-rent" required hint="Enter the amount in your local currency.">
            <Input
              id="property-rent"
              type="number"
              min={0}
              step="0.01"
              value={form.rent}
              onChange={update("rent")}
              required
            />
          </FormField>
          {!editingProperty ? (
            <FormField
              label={unitLabelFor(form.category, form.propertyType).label}
              htmlFor="property-units"
              hint={`Creates numbered ${unitNoun(form.category, form.propertyType, 2)} automatically. Leave 0 for a single let property.`}
              className="sm:col-span-2"
            >
              <Input
                id="property-units"
                type="number"
                min={0}
                max={100}
                value={form.unitCount}
                onChange={update("unitCount")}
              />
            </FormField>
          ) : null}
          <FormField label="Description" htmlFor="property-description" className="sm:col-span-2">
            <Textarea
              id="property-description"
              value={form.description}
              onChange={update("description")}
              maxLength={1000}
            />
          </FormField>
          <FormField
            label="Property image"
            htmlFor="property-image"
            className="sm:col-span-2"
          >
            <div className="rounded-xl border border-dashed border-hairline-strong bg-surface-subtle p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {imagePreview || (editingProperty?.image_storage_key && !imageFile) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      imagePreview ??
                      `/api/tenancy/properties/${editingProperty?.id}/image?v=${encodeURIComponent(editingProperty?.updated_at ?? "")}`
                    }
                    alt="Property preview"
                    className="h-28 w-full rounded-lg border border-hairline object-cover sm:w-44"
                  />
                ) : (
                  <div className="flex h-28 w-full items-center justify-center rounded-lg border border-dashed border-hairline-strong text-[12px] text-slate sm:w-44">
                    No image selected
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {imageFile
                        ? imageFile.name
                        : editingProperty?.image_storage_key
                          ? "Current property image"
                          : "PNG, JPEG or WebP up to 5 MB."}
                    </p>
                    <p className="text-[11.5px] text-slate">
                      {imageFile
                        ? formatBytes(imageFile.size)
                        : "Stored privately for this workspace and shown on the property card."}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-hairline bg-card px-3 py-1.5 text-[12px] font-medium text-ink hover:border-brand-500">
                      <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                      {imageFile ? "Change image" : "Browse"}
                      <input
                        id="property-image"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(event) => {
                          pickImage(event.target.files?.[0] ?? null);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    {imageFile ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => pickImage(null)}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </FormField>
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
  const [bulk, setBulk] = useState({ count: "10", unitType: "Standard", bedrooms: "1", rent: "" });

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
      occupancyStatus: unit.occupancy_status,
      rent: (unit.rent_amount_cents / 100).toString(),
      description: unit.description ?? "",
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!property) return;
    setSaving(true);
    setError(null);
    const payload = {
      unitNumber: form.unitNumber,
      unitType: form.unitType,
      bedrooms: Number(form.bedrooms || 0),
      occupancyStatus: form.occupancyStatus,
      rentAmountCents: Math.round(Number(form.rent || 0) * 100),
      description: form.description || null,
    };
    try {
      if (editingId) {
        await apiFetch(`/api/tenancy/units/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast({ title: "Unit updated", description: `Unit ${form.unitNumber} has been saved.` });
      } else {
        await apiFetch("/api/tenancy/units", {
          method: "POST",
          body: JSON.stringify({ propertyId: property.id, ...payload }),
        });
        toast({ title: "Unit added", description: `Unit ${form.unitNumber} is ready.` });
      }
      resetForm();
      onChanged();
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

  const generate = async () => {
    if (!property) return;
    const count = Math.max(1, Math.min(100, Math.round(Number(bulk.count || 0))));
    const existing = new Set(units.map((unit) => unit.unit_number));
    const newUnits = Array.from({ length: count }, (_, index) => String(index + 1))
      .filter((number) => !existing.has(number))
      .map((number) => ({
        unitNumber: number,
        unitType: bulk.unitType || "Standard",
        bedrooms: Number(bulk.bedrooms || 0),
        occupancyStatus: "available",
        rentAmountCents: Math.round(Number(bulk.rent || 0) * 100),
        description: null,
      }));
    if (newUnits.length === 0) {
      toast({ title: "Nothing to add", description: "Those unit numbers already exist." });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/tenancy/units", {
        method: "POST",
        body: JSON.stringify({ propertyId: property.id, units: newUnits }),
      });
      toast({ title: "Units generated", description: `${newUnits.length} unit(s) added.` });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "The units could not be generated.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(property)}
      onClose={onClose}
      title={property ? `Units · ${property.name}` : "Units"}
      description="Each unit has its own ID, rent and occupancy status. Tenant inquiries can target a specific unit."
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
            No units yet. Add one below, or generate a numbered block.
          </p>
        ) : (
          <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
            {units.map((unit) => (
              <li key={unit.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink">
                    Unit {unit.unit_number} · {unit.unit_type}
                  </p>
                  <p className="text-[11.5px] text-slate">
                    {unit.bedrooms} bed · {formatMoney(unit.rent_amount_cents)} / month · {unit.inquiry_count} inquir
                    {unit.inquiry_count === 1 ? "y" : "ies"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={OCCUPANCY_TONE[unit.occupancy_status]}>{unit.occupancy_status}</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editUnit(unit)}
                    aria-label={`Edit unit ${unit.unit_number}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeUnit(unit)} aria-label={`Delete unit ${unit.unit_number}`}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={submit} className="space-y-3 rounded-lg border border-hairline bg-surface-subtle p-4">
            <p className="text-[13px] font-semibold text-ink">{editingId ? "Edit unit" : "Add a unit"}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Unit number or name" htmlFor="unit-number" required>
                <Input id="unit-number" value={form.unitNumber} onChange={update("unitNumber")} required />
              </FormField>
              <FormField label="Unit type" htmlFor="unit-type" required>
                <Input id="unit-type" value={form.unitType} onChange={update("unitType")} required />
              </FormField>
              <FormField label="Bedrooms" htmlFor="unit-bedrooms">
                <Input id="unit-bedrooms" type="number" min={0} max={50} value={form.bedrooms} onChange={update("bedrooms")} />
              </FormField>
              <FormField label="Occupancy" htmlFor="unit-occupancy">
                <Select id="unit-occupancy" value={form.occupancyStatus} onChange={update("occupancyStatus")}>
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="maintenance">Maintenance</option>
                </Select>
              </FormField>
              <FormField label="Monthly rent" htmlFor="unit-rent">
                <Input id="unit-rent" type="number" min={0} step="0.01" value={form.rent} onChange={update("rent")} />
              </FormField>
              <FormField label="Description" htmlFor="unit-description">
                <Input id="unit-description" value={form.description} onChange={update("description")} maxLength={1000} />
              </FormField>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" loading={saving}>
                {editingId ? "Save unit" : "Add unit"}
              </Button>
              {editingId ? (
                <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                  Cancel edit
                </Button>
              ) : null}
            </div>
            {editingId && property ? (
              <UnitFiles unitId={editingId} onChanged={onChanged} />
            ) : null}
          </form>

          <div className="space-y-3 rounded-lg border border-hairline bg-surface-subtle p-4">
            <p className="text-[13px] font-semibold text-ink">Generate numbered units</p>
            <p className="text-[12px] text-slate">
              Adds units numbered 1 to the count you choose, skipping numbers that already exist.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="How many units" htmlFor="bulk-count">
                <Input
                  id="bulk-count"
                  type="number"
                  min={1}
                  max={100}
                  value={bulk.count}
                  onChange={(event) => setBulk((current) => ({ ...current, count: event.target.value }))}
                />
              </FormField>
              <FormField label="Unit type" htmlFor="bulk-type">
                <Input
                  id="bulk-type"
                  value={bulk.unitType}
                  onChange={(event) => setBulk((current) => ({ ...current, unitType: event.target.value }))}
                />
              </FormField>
              <FormField label="Bedrooms" htmlFor="bulk-bedrooms">
                <Input
                  id="bulk-bedrooms"
                  type="number"
                  min={0}
                  max={50}
                  value={bulk.bedrooms}
                  onChange={(event) => setBulk((current) => ({ ...current, bedrooms: event.target.value }))}
                />
              </FormField>
              <FormField label="Monthly rent" htmlFor="bulk-rent">
                <Input
                  id="bulk-rent"
                  type="number"
                  min={0}
                  step="0.01"
                  value={bulk.rent}
                  onChange={(event) => setBulk((current) => ({ ...current, rent: event.target.value }))}
                />
              </FormField>
            </div>
            <Button type="button" variant="secondary" size="sm" loading={saving} onClick={generate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Generate units
            </Button>
            {error ? (
              <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-[12.5px] text-danger">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>
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
