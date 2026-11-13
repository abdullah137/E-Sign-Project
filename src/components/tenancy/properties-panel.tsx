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
  description: "",
  addressLine1: "",
  city: "",
  state: "",
  postalCode: "",
  bedrooms: "2",
  bathrooms: "1",
  rent: "",
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

const EMPTY_UNIT_FORM = {
  unitNumber: "",
  unitType: "Standard",
  bedrooms: "1",
  bathrooms: "1",
  occupancyStatus: "available" as UnitOccupancy,
  rent: "",
  description: "",
  images: [] as Array<{ file: File; url: string }>,
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

const MAX_PROPERTY_IMAGES = 12;
const MAX_PROPERTY_IMAGE_BYTES = 5 * 1024 * 1024;

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
  const [imageFiles, setImageFiles] = useState<Array<{ file: File; url: string }>>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [removingImage, setRemovingImage] = useState(false);
  const imageFilesRef = useRef(imageFiles);
  imageFilesRef.current = imageFiles;

  useEffect(
    () => () => {
      for (const item of imageFilesRef.current) URL.revokeObjectURL(item.url);
    },
    [],
  );

  const clearImageFiles = () => {
    setImageFiles((current) => {
      for (const item of current) URL.revokeObjectURL(item.url);
      return [];
    });
  };

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
    clearImageFiles();
    setRemovedImageIds([]);
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
      description: property.description ?? "",
      addressLine1: property.address_line1,
      city: property.city,
      state: property.state,
      postalCode: property.postal_code ?? "",
      bedrooms: String(property.bedrooms),
      bathrooms: String(property.bathrooms),
      rent: (property.rent_amount_cents / 100).toString(),
      inquiryFee: property.inquiry_fee_cents > 0 ? (property.inquiry_fee_cents / 100).toString() : "",
      unitCount: "0",
      status: property.status,
    });
    clearImageFiles();
    setRemovedImageIds([]);
    setError(null);
    setPropertyOpen(true);
  };

  const closePropertyModal = () => {
    setPropertyOpen(false);
    setEditingProperty(null);
    clearImageFiles();
    setRemovedImageIds([]);
    setError(null);
  };

  const pickImages = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const existingCount = (editingProperty?.images ?? []).filter(
      (image) => !removedImageIds.includes(image.id),
    ).length;
    const room = MAX_PROPERTY_IMAGES - existingCount - imageFiles.length;
    if (room <= 0) {
      setError(`A property can have up to ${MAX_PROPERTY_IMAGES} photos.`);
      return;
    }
    const accepted: Array<{ file: File; url: string }> = [];
    for (const file of Array.from(files).slice(0, room)) {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        setError("Upload PNG, JPEG or WebP images only.");
        continue;
      }
      if (file.size > MAX_PROPERTY_IMAGE_BYTES) {
        setError("Each image must be 5 MB or smaller.");
        continue;
      }
      accepted.push({ file, url: URL.createObjectURL(file) });
    }
    if (accepted.length) setImageFiles((current) => [...current, ...accepted]);
  };

  const removePendingImage = (index: number) => {
    setImageFiles((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const toggleExistingImage = (imageId: string) => {
    setRemovedImageIds((current) =>
      current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId],
    );
  };

  const syncImages = async (propertyId: string) => {
    for (const imageId of removedImageIds) {
      await apiFetch(
        `/api/tenancy/properties/${propertyId}/image?imageId=${encodeURIComponent(imageId)}`,
        { method: "DELETE" },
      );
    }
    if (imageFiles.length > 0) {
      const body = new FormData();
      for (const item of imageFiles) body.append("images", item.file);
      await apiFetch(`/api/tenancy/properties/${propertyId}/image`, { method: "POST", body });
    }
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
    setSaving(true);
    setError(null);
    const rentAmount = Number(form.rent);
    const inquiryFee = Number(form.inquiryFee);
    if (!Number.isInteger(rentAmount) || rentAmount < 0) {
      setError("Enter the yearly rent as a whole number.");
      setSaving(false);
      return;
    }
    if (form.inquiryFee !== "" && (!Number.isInteger(inquiryFee) || inquiryFee < 0)) {
      setError("Enter the inquiry fee as a whole number.");
      setSaving(false);
      return;
    }
    const unitTotal = Math.max(0, Math.min(100, Math.round(Number(form.unitCount || 0))));
    const payload = {
      landlordId: form.landlordId,
      reference: form.reference || null,
      name: form.name,
      category: form.category,
      propertyType: form.propertyType,
      listingType: form.listingType,
      description: form.description || null,
      addressLine1: form.addressLine1,
      city: form.city,
      state: form.state,
      postalCode: form.postalCode || null,
      bedrooms: Number(form.bedrooms || 0),
      bathrooms: Number(form.bathrooms || 0),
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
        try {
          await syncImages(editingProperty.id);
        } catch (imageError) {
          toast({
            title: "Photos not saved",
            description:
              imageError instanceof ApiClientError
                ? `The property was saved. ${imageError.message}`
                : "The property was saved, but the photos could not be updated.",
          });
        }
        toast({ title: "Property updated", description: `${form.name} has been saved.` });
        setPropertyOpen(false);
        setEditingProperty(null);
        clearImageFiles();
        setRemovedImageIds([]);
        router.refresh();
      } else {
        const result = await apiFetch<{ property: { id: string; name: string } }>("/api/tenancy/properties", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        try {
          await syncImages(result.property.id);
        } catch (imageError) {
          toast({
            title: "Photos not saved",
            description:
              imageError instanceof ApiClientError
                ? `The property was added. ${imageError.message}`
                : "The property was added, but the photos could not be uploaded.",
          });
        }
        if (unitTotal > 0) {
          const propertyId = result.property.id;
          const propertyName = result.property.name;
          setPropertyOpen(false);
          setForm({ ...EMPTY_PROPERTY_FORM, landlordId: landlords[0]?.id ?? "" });
          clearImageFiles();
          setRemovedImageIds([]);
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
        clearImageFiles();
        setRemovedImageIds([]);
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

  const visibleImages = (editingProperty?.images ?? []).filter(
    (image) => !removedImageIds.includes(image.id),
  );

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
                      {formatMoney(property.rent_amount_cents)}
                      <span className="font-normal text-slate"> / year</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate">Units</dt>
                    <dd className="mt-0.5 font-semibold text-ink">{propertyUnits.length || property.unit_count}</dd>
                  </div>
                  <div>
                    <dt className="text-slate">Bedrooms</dt>
                    <dd className="mt-0.5 font-semibold text-ink">{property.bedrooms}</dd>
                  </div>
                  <div>
                    <dt className="text-slate">Bathrooms</dt>
                    <dd className="mt-0.5 font-semibold text-ink">{property.bathrooms}</dd>
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
        description="A unique reference is generated automatically. The rent and address are prefilled into agreements prepared from this property."
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
            <Input
              id="property-bedrooms"
              type="number"
              min={0}
              max={50}
              step={1}
              inputMode="numeric"
              value={form.bedrooms}
              onChange={update("bedrooms")}
            />
          </FormField>
          <FormField label="Bathrooms" htmlFor="property-bathrooms">
            <Input
              id="property-bathrooms"
              type="number"
              min={0}
              max={50}
              step={1}
              inputMode="numeric"
              value={form.bathrooms}
              onChange={update("bathrooms")}
            />
          </FormField>
          <FormField
            label="Yearly rent"
            htmlFor="property-rent"
            required
            className="sm:col-span-2"
            hint="Enter the amount in your local currency. Whole numbers only."
          >
            <Input
              id="property-rent"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={form.rent}
              onChange={update("rent")}
              required
            />
          </FormField>
          {!editingProperty ? (
            <FormField
              label={unitLabelFor(form.category, form.propertyType).label}
              htmlFor="property-units"
              hint={`You will fill in each ${unitNoun(form.category, form.propertyType, 1)} one by one. Leave 0 for a single let property.`}
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
          <FormField label="Description" htmlFor="property-description" className="sm:col-span-2">
            <Textarea
              id="property-description"
              value={form.description}
              onChange={update("description")}
              maxLength={1000}
            />
          </FormField>
          <FormField
            label="Property photos"
            htmlFor="property-image"
            className="sm:col-span-2"
            hint={`Optional. Add up to ${MAX_PROPERTY_IMAGES} photos.`}
          >
            <div className="rounded-xl border border-dashed border-hairline-strong bg-surface-subtle p-4">
              {visibleImages.length > 0 || imageFiles.length > 0 ? (
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {visibleImages.map((image) => (
                    <div key={image.id} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={propertyImageUrl(editingProperty!.id, image, editingProperty!.updated_at)}
                        alt={image.original_filename ?? "Property photo"}
                        className="h-24 w-full rounded-lg border border-hairline object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => toggleExistingImage(image.id)}
                        aria-label="Remove photo"
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-white hover:bg-ink"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  {imageFiles.map((item, index) => (
                    <div key={item.url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={item.file.name}
                        className="h-24 w-full rounded-lg border border-hairline object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePendingImage(index)}
                        aria-label="Remove selected photo"
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-white hover:bg-ink"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mb-4 flex h-24 items-center justify-center rounded-lg border border-dashed border-hairline-strong text-[12px] text-slate">
                  No photos selected
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[12px] text-slate">
                    PNG, JPEG or WebP up to 5 MB each. Stored privately for this workspace.
                  </p>
                  {removedImageIds.length > 0 ? (
                    <p className="mt-1 text-[11.5px] text-danger">
                      {removedImageIds.length} photo{removedImageIds.length === 1 ? "" : "s"} will be
                      removed when you save.
                    </p>
                  ) : null}
                </div>
                <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-hairline bg-card px-3 py-1.5 text-[12px] font-medium text-ink hover:border-brand-500">
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  {imageFiles.length > 0 || visibleImages.length > 0 ? "Add more photos" : "Browse photos"}
                  <input
                    id="property-image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="sr-only"
                    onChange={(event) => {
                      pickImages(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
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

function acceptUnitImages(
  files: FileList | null,
): { accepted: Array<{ file: File; url: string }>; error: string | null } {
  if (!files || files.length === 0) return { accepted: [], error: null };
  const accepted: Array<{ file: File; url: string }> = [];
  let error: string | null = null;
  for (const file of Array.from(files)) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      error = "Upload PNG, JPEG or WebP images only.";
      continue;
    }
    if (file.size > MAX_PROPERTY_IMAGE_BYTES) {
      error = "Each image must be 5 MB or smaller.";
      continue;
    }
    accepted.push({ file, url: URL.createObjectURL(file) });
  }
  return { accepted, error };
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
      <FormField label="Unit name or number" htmlFor={`${idPrefix}-number`} required>
        <Input id={`${idPrefix}-number`} value={form.unitNumber} onChange={update("unitNumber")} required />
      </FormField>
      <FormField label="Unit type" htmlFor={`${idPrefix}-type`} required>
        <Input id={`${idPrefix}-type`} value={form.unitType} onChange={update("unitType")} required />
      </FormField>
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
      <FormField label="Bathrooms and toilets" htmlFor={`${idPrefix}-bathrooms`}>
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
      <FormField label="Occupancy" htmlFor={`${idPrefix}-occupancy`}>
        <Select id={`${idPrefix}-occupancy`} value={form.occupancyStatus} onChange={update("occupancyStatus")}>
          <option value="available">Available</option>
          <option value="occupied">Occupied</option>
          <option value="maintenance">Maintenance</option>
        </Select>
      </FormField>
      <FormField label="Yearly rent" htmlFor={`${idPrefix}-rent`}>
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

function UnitImagePicker({
  images,
  onPick,
  onRemove,
  idPrefix,
}: {
  images: Array<{ file: File; url: string }>;
  onPick: (files: FileList | null) => void;
  onRemove: (index: number) => void;
  idPrefix: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-hairline-strong bg-surface-subtle/30 p-3">
      <div className="flex flex-wrap items-center gap-3">
        {images.map((image, index) => (
          <div key={image.url} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={image.file.name}
              className="h-16 w-20 rounded-md border border-hairline object-cover"
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              aria-label={`Remove ${image.file.name}`}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-white hover:bg-ink"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        ))}
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-hairline bg-card px-3 py-1.5 text-[12px] font-medium text-ink hover:border-brand-500">
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          Add photos
          <input
            id={idPrefix}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="sr-only"
            onChange={(event) => {
              onPick(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        <span className="text-[11.5px] text-slate">PNG, JPEG or WebP, up to 5 MB each.</span>
      </div>
    </div>
  );
}

async function uploadUnitImages(unitId: string, images: Array<{ file: File; url: string }>): Promise<void> {
  for (const image of images) {
    const body = new FormData();
    body.set("file", image.file);
    await apiFetch(`/api/tenancy/units/${unitId}/files`, { method: "POST", body });
  }
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
  const pendingUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!property) {
      for (const url of pendingUrlsRef.current) URL.revokeObjectURL(url);
      pendingUrlsRef.current = [];
    }
  }, [property]);

  const update = (field: keyof typeof form) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const resetForm = () => {
    for (const image of form.images) URL.revokeObjectURL(image.url);
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
      occupancyStatus: unit.occupancy_status,
      rent: (unit.rent_amount_cents / 100).toString(),
      description: unit.description ?? "",
      images: [],
    });
    setError(null);
  };

  const pickUnitImages = (files: FileList | null) => {
    const { accepted, error: pickError } = acceptUnitImages(files);
    if (pickError) setError(pickError);
    if (accepted.length) {
      for (const image of accepted) pendingUrlsRef.current.push(image.url);
      setForm((current) => ({ ...current, images: [...current.images, ...accepted] }));
    }
  };

  const removeUnitImage = (index: number) => {
    setForm((current) => {
      const target = current.images[index];
      if (target) URL.revokeObjectURL(target.url);
      return { ...current, images: current.images.filter((_, itemIndex) => itemIndex !== index) };
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!property) return;
    const rent = Number(form.rent);
    if (!form.unitNumber.trim()) {
      setError("Enter a unit name or number.");
      return;
    }
    if (!Number.isInteger(rent) || rent < 0) {
      setError("Enter the yearly rent as a whole number.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      unitNumber: form.unitNumber,
      unitType: form.unitType,
      bedrooms: Math.round(Number(form.bedrooms || 0)),
      bathrooms: Math.round(Number(form.bathrooms || 0)),
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
        const result = await apiFetch<{ unit: { id: string } }>("/api/tenancy/units", {
          method: "POST",
          body: JSON.stringify({ propertyId: property.id, ...payload }),
        });
        if (form.images.length > 0) {
          try {
            await uploadUnitImages(result.unit.id, form.images);
          } catch (imageError) {
            toast({
              title: "Photos not saved",
              description:
                imageError instanceof ApiClientError
                  ? `The unit was added. ${imageError.message}`
                  : "The unit was added, but the photos could not be uploaded.",
            });
          }
        }
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
                      {unit.bedrooms} bed · {unit.bathrooms ?? 1} bath · {formatMoney(unit.rent_amount_cents)} /
                      year · {unit.inquiry_count} inquir
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
                    <UnitImagePicker
                      images={form.images}
                      onPick={pickUnitImages}
                      onRemove={removeUnitImage}
                      idPrefix={`edit-img-${unit.id}`}
                    />
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
            <UnitImagePicker
              images={form.images}
              onPick={pickUnitImages}
              onRemove={removeUnitImage}
              idPrefix="unit-img"
            />
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (wizard) {
      setIndex(0);
      setDone(0);
      setForm({ ...EMPTY_UNIT_FORM, unitNumber: "1" });
      setError(null);
    } else {
      for (const url of pendingUrlsRef.current) URL.revokeObjectURL(url);
      pendingUrlsRef.current = [];
    }
  }, [wizard]);

  const update = (field: keyof typeof form) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const pickUnitImages = (files: FileList | null) => {
    const { accepted, error: pickError } = acceptUnitImages(files);
    if (pickError) setError(pickError);
    if (accepted.length) {
      for (const image of accepted) pendingUrlsRef.current.push(image.url);
      setForm((current) => ({ ...current, images: [...current.images, ...accepted] }));
    }
  };

  const removeUnitImage = (index: number) => {
    setForm((current) => {
      const target = current.images[index];
      if (target) URL.revokeObjectURL(target.url);
      return { ...current, images: current.images.filter((_, itemIndex) => itemIndex !== index) };
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
    if (!Number.isInteger(rent) || rent < 0) {
      setError("Enter the yearly rent as a whole number.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch<{ unit: { id: string } }>("/api/tenancy/units", {
        method: "POST",
        body: JSON.stringify({
          propertyId: wizard.propertyId,
          unitNumber: form.unitNumber,
          unitType: form.unitType,
          bedrooms: Math.round(Number(form.bedrooms || 0)),
          bathrooms: Math.round(Number(form.bathrooms || 0)),
          occupancyStatus: form.occupancyStatus,
          rentAmountCents: rent * 100,
          description: form.description || null,
        }),
      });
      if (form.images.length > 0) {
        try {
          await uploadUnitImages(result.unit.id, form.images);
        } catch (imageError) {
          toast({
            title: "Photos not saved",
            description:
              imageError instanceof ApiClientError
                ? `The unit was saved. ${imageError.message}`
                : "The unit was saved, but the photos could not be uploaded.",
          });
        }
      }
      const nextDone = done + 1;
      setDone(nextDone);
      if (nextDone >= wizard.count) {
        toast({
          title: "Property added",
          description: `${wizard.propertyName} and ${wizard.count} ${wizard.count === 1 ? "unit" : "units"} are ready.`,
        });
        onFinished();
      } else {
        for (const image of form.images) URL.revokeObjectURL(image.url);
        setForm({ ...EMPTY_UNIT_FORM, unitNumber: String(nextDone + 1) });
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
        <UnitImagePicker
          images={form.images}
          onPick={pickUnitImages}
          onRemove={removeUnitImage}
          idPrefix="wizard-img"
        />
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
