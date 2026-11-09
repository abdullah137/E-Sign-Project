import type { DatabaseSync } from "node:sqlite";
import {
  addDaysIso,
  hashToken,
  newId,
  newToken,
  normalizeEmail,
  nowIso,
  safeEqual,
  sha256Hex,
} from "./ids";
import { appendAuditEvent } from "./audit";
import { appLink, queueEmail } from "./email";
import { getPrecedent } from "./precedents";
import { buildAgreementPdf } from "./pdf/agreement";
import { buildInquirySummaryPdf } from "./pdf/inquiry";
import { isValidEmail } from "./field-types";
import { deleteStoredObject, saveBuffer, readStoredObject } from "./storage";
import { readBrandLogo } from "./brand-logo";
import { initializePaystackTransaction, verifyPaystackTransaction } from "./paystack";
import { transaction } from "./db";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { formatMoney } from "./money";

function plainRows<T>(rows: readonly unknown[]): T[] {
  return rows.map((row) => ({ ...(row as object) }) as unknown as T);
}

export type InquiryStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "DECLINED"
  | "LANDLORD_REVIEW"
  | "LANDLORD_APPROVED"
  | "LANDLORD_DECLINED"
  | "AGREEMENT_CREATED";

export type PropertyStatus = "available" | "occupied" | "maintenance" | "archived";

export type InquiryPaymentStatus = "not_required" | "pending" | "paid" | "failed";

export interface LandlordFileRow {
  id: string;
  landlord_id: string;
  kind: string;
  original_filename: string;
  mime: string;
  bytes: number;
  sha256: string;
  storage_key: string;
  created_at: string;
}

export interface LandlordRow {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  email: string;
  email_normalized: string;
  phone: string;
  notes: string | null;
  id_type: string | null;
  id_number: string | null;
  law_firm_name: string | null;
  law_firm_address: string | null;
  law_firm_phone: string | null;
  law_firm_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyRow {
  id: string;
  workspace_id: string;
  landlord_id: string;
  created_by: string;
  reference: string;
  name: string;
  category: string;
  property_type: string;
  description: string | null;
  unit_count: number;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string | null;
  bedrooms: number;
  rent_amount_cents: number;
  inquiry_fee_cents: number;
  image_storage_key: string | null;
  image_mime: string | null;
  status: PropertyStatus;
  created_at: string;
  updated_at: string;
}

export interface PropertyListRow extends PropertyRow {
  landlord_name: string;
  landlord_email: string;
  inquiry_count: number;
  active_tenants: number;
}

export type UnitOccupancy = "available" | "occupied" | "maintenance";

export interface PropertyUnitRow {
  id: string;
  workspace_id: string;
  property_id: string;
  unit_number: string;
  unit_type: string;
  bedrooms: number;
  occupancy_status: UnitOccupancy;
  rent_amount_cents: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface UnitFileRow {
  id: string;
  unit_id: string;
  kind: string;
  original_filename: string;
  mime: string;
  bytes: number;
  sha256: string;
  storage_key: string;
  created_at: string;
}

export interface PropertyUnitListRow extends PropertyUnitRow {
  property_name: string;
  property_reference: string;
  inquiry_count: number;
}

export interface InquiryRow {
  id: string;
  workspace_id: string;
  property_id: string;
  unit_id: string | null;
  landlord_id: string;
  created_by: string;
  applicant_name: string;
  applicant_email: string;
  applicant_email_normalized: string;
  applicant_phone: string;
  current_address: string | null;
  current_city: string | null;
  current_state: string | null;
  reason_for_moving: string | null;
  marital_status: string | null;
  children_count: number | null;
  employment_status: string | null;
  employer: string | null;
  occupation: string | null;
  income_range: string | null;
  religion_state: string | null;
  id_type: string | null;
  id_number: string | null;
  employment_address: string | null;
  occupants_count: number | null;
  dependents_count: number | null;
  bedrooms_required: number | null;
  state_of_origin: string | null;
  additional_info: string | null;
  declaration_accepted: number;
  notes: string | null;
  signature_name: string | null;
  status: InquiryStatus;
  tenant_token_hash: string | null;
  tenant_token_expires_at: string | null;
  landlord_token_hash: string | null;
  landlord_token_expires_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  forwarded_at: string | null;
  landlord_reviewed_at: string | null;
  landlord_comment: string | null;
  lawyer_note: string | null;
  payment_status: InquiryPaymentStatus;
  payment_reference: string | null;
  payment_url: string | null;
  inquiry_fee_cents: number | null;
  payment_fee_cents: number;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InquiryListRow extends InquiryRow {
  property_name: string;
  property_reference: string;
  unit_number: string | null;
  landlord_name: string;
  guarantor_count: number;
  agreement_count: number;
}

export interface GuarantorRow {
  id: string;
  inquiry_id: string;
  name: string;
  email: string;
  email_normalized: string;
  relationship: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface InquiryFileRow {
  id: string;
  inquiry_id: string;
  kind: string;
  original_filename: string;
  mime: string;
  bytes: number;
  sha256: string;
  storage_key: string;
  created_at: string;
}

export interface InquiryDetail {
  inquiry: InquiryRow;
  property: PropertyRow;
  unit: PropertyUnitRow | null;
  landlord: LandlordRow;
  guarantors: GuarantorRow[];
  files: InquiryFileRow[];
  agreement: { id: string; document_id: string } | null;
}

export interface InquiryContext {
  inquiry: InquiryRow;
  property: PropertyRow;
  unit: PropertyUnitRow | null;
  landlord: LandlordRow;
  guarantors: GuarantorRow[];
  workspace: { id: string; name: string; brand_display_name: string | null; plan: string };
  files: InquiryFileRow[];
}

export interface AgreementListRow {
  id: string;
  workspace_id: string;
  document_id: string;
  inquiry_id: string | null;
  unit_id: string | null;
  unit_number: string | null;
  lawyer_name: string | null;
  lawyer_email: string | null;
  title: string;
  start_date: string;
  end_date: string;
  rent_amount_cents: number;
  created_at: string;
  document_status: string;
  property_name: string | null;
  property_reference: string | null;
  landlord_name: string | null;
  tenant_name: string | null;
  signer_count: number;
  signed_count: number;
}

export interface PaymentRow {
  id: string;
  workspace_id: string;
  agreement_id: string | null;
  property_id: string | null;
  recorded_by: string;
  description: string;
  amount_cents: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  method: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentListRow extends PaymentRow {
  property_name: string | null;
  tenant_name: string | null;
}

export interface TenancyStats {
  landlords: number;
  properties: number;
  submitted: number;
  awaitingLandlord: number;
  approved: number;
  agreements: number;
  duePayments: number;
  renewalsSoon: number;
}

export interface CaseEventRow {
  id: string;
  entity_kind: string;
  entity_id: string;
  event_type: string;
  actor_kind: string;
  actor_label: string | null;
  metadata_json: string;
  at: string;
}

export interface InquirySubmission {
  unitId?: string | null;
  currentAddress: string;
  currentCity?: string | null;
  currentState?: string | null;
  reasonForMoving?: string | null;
  maritalStatus?: string | null;
  childrenCount?: number | null;
  employmentStatus?: string | null;
  employer?: string | null;
  occupation?: string | null;
  employmentAddress?: string | null;
  incomeRange?: string | null;
  religionState?: string | null;
  occupantsCount?: number | null;
  dependentsCount?: number | null;
  bedroomsRequired?: number | null;
  stateOfOrigin?: string | null;
  additionalInfo?: string | null;
  notes?: string | null;
  declarationAccepted?: boolean;
  signatureName: string;
  guarantors: Array<{ name?: string; email?: string; relationship?: string }>;
}

const INQUIRY_TOKEN_DAYS = 30;
const LANDLORD_TOKEN_DAYS = 30;
const MAX_ID_BYTES = 5 * 1024 * 1024;
const MAX_PASSPORT_BYTES = 2 * 1024 * 1024;
const MAX_INQUIRY_FEE_CENTS = 100_000_000;

function clampInquiryFeeCents(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_INQUIRY_FEE_CENTS, Math.round(value)));
}

export function inquiryFeeCentsFor(
  inquiry: Pick<InquiryRow, "status" | "inquiry_fee_cents" | "payment_fee_cents">,
  property: Pick<PropertyRow, "inquiry_fee_cents">,
): number {
  if (inquiry.status !== "DRAFT") return clampInquiryFeeCents(inquiry.payment_fee_cents);
  const override = inquiry.inquiry_fee_cents;
  return clampInquiryFeeCents(override === null ? property.inquiry_fee_cents : override);
}

function isoOrNull(value: string | null | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}

function text(value: string | null | undefined, max: number, fallback = ""): string {
  return (value || fallback).trim().slice(0, max);
}

export function appendCaseEvent(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    entityKind: string;
    entityId: string;
    eventType: string;
    actorKind: string;
    actorId?: string | null;
    actorLabel?: string | null;
    metadata?: Record<string, unknown>;
  },
): void {
  db.prepare(
    `INSERT INTO case_events
      (id, workspace_id, entity_kind, entity_id, event_type, actor_kind, actor_id, actor_label, metadata_json, at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId("evt"),
    input.workspaceId,
    input.entityKind,
    input.entityId,
    input.eventType,
    input.actorKind,
    input.actorId ?? null,
    input.actorLabel ?? null,
    JSON.stringify(input.metadata ?? {}),
    nowIso(),
  );
}

export function listCaseEvents(db: DatabaseSync, entityKind: string, entityId: string): CaseEventRow[] {
  const rows = db
    .prepare(
      "SELECT * FROM case_events WHERE entity_kind = ? AND entity_id = ? ORDER BY at ASC",
    )
    .all(entityKind, entityId);
  return plainRows<CaseEventRow>(rows);
}

export function listLandlords(db: DatabaseSync, workspaceId: string): LandlordRow[] {
  const rows = db
    .prepare("SELECT * FROM landlords WHERE workspace_id = ? ORDER BY name ASC")
    .all(workspaceId);
  return plainRows<LandlordRow>(rows);
}

export function getLandlord(
  db: DatabaseSync,
  workspaceId: string,
  landlordId: string,
): LandlordRow | undefined {
  return db
    .prepare("SELECT * FROM landlords WHERE id = ? AND workspace_id = ?")
    .get(landlordId, workspaceId) as unknown as LandlordRow | undefined;
}

export interface LandlordInput {
  name: string;
  email: string;
  phone: string;
  notes?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  lawFirmName?: string | null;
  lawFirmAddress?: string | null;
  lawFirmPhone?: string | null;
  lawFirmEmail?: string | null;
}

function landlordColumns(input: LandlordInput): (string | null)[] {
  return [
    text(input.name, 120),
    text(input.email, 254),
    text(input.phone, 40),
    isoOrNull(input.notes),
    isoOrNull(input.idType),
    isoOrNull(input.idNumber),
    isoOrNull(input.lawFirmName),
    isoOrNull(input.lawFirmAddress),
    isoOrNull(input.lawFirmPhone),
    isoOrNull(input.lawFirmEmail),
  ];
}

function validateLandlord(input: LandlordInput, normalized: string): void {
  if (text(input.name, 120).length < 2) throw new ValidationError("Enter the landlord's full name.");
  if (!isValidEmail(text(input.email, 254))) throw new ValidationError("Enter a valid landlord email address.");
  if (text(input.phone, 40).length < 5) throw new ValidationError("Enter a landlord phone number.");
  if (input.lawFirmEmail && !isValidEmail(text(input.lawFirmEmail, 254))) {
    throw new ValidationError("Enter a valid law firm email address.");
  }
  if (!normalized) throw new ValidationError("Enter a valid landlord email address.");
}

export function createLandlord(
  db: DatabaseSync,
  input: LandlordInput & {
    workspaceId: string;
    userId: string;
    userLabel: string;
  },
): LandlordRow {
  const normalized = normalizeEmail(text(input.email, 254));
  validateLandlord(input, normalized);
  const existing = db
    .prepare("SELECT id FROM landlords WHERE workspace_id = ? AND email_normalized = ?")
    .get(input.workspaceId, normalized);
  if (existing) throw new ConflictError("A landlord with this email already exists in the workspace.");
  const id = newId("lnd");
  const now = nowIso();
  const [name, email, phone, notes, idType, idNumber, firmName, firmAddress, firmPhone, firmEmail] =
    landlordColumns(input);
  transaction(db, () => {
    db.prepare(
      `INSERT INTO landlords
        (id, workspace_id, created_by, name, email, email_normalized, phone, notes,
         id_type, id_number, law_firm_name, law_firm_address, law_firm_phone, law_firm_email,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.workspaceId,
      input.userId,
      name,
      email,
      normalized,
      phone,
      notes,
      idType,
      idNumber,
      firmName,
      firmAddress,
      firmPhone,
      firmEmail,
      now,
      now,
    );
    appendCaseEvent(db, {
      workspaceId: input.workspaceId,
      entityKind: "landlord",
      entityId: id,
      eventType: "landlord.created",
      actorKind: "sender",
      actorId: input.userId,
      actorLabel: input.userLabel,
      metadata: { name, email },
    });
  });
  return getLandlord(db, input.workspaceId, id) as LandlordRow;
}

export function updateLandlord(
  db: DatabaseSync,
  input: LandlordInput & {
    workspaceId: string;
    landlordId: string;
    actor: { id: string; label: string };
  },
): LandlordRow {
  const current = getLandlord(db, input.workspaceId, input.landlordId);
  if (!current) throw new NotFoundError("Landlord not found.");
  const normalized = normalizeEmail(text(input.email, 254));
  validateLandlord(input, normalized);
  const duplicate = db
    .prepare("SELECT id FROM landlords WHERE workspace_id = ? AND email_normalized = ? AND id != ?")
    .get(input.workspaceId, normalized, current.id);
  if (duplicate) throw new ConflictError("Another landlord already uses this email address.");
  const [name, email, phone, notes, idType, idNumber, firmName, firmAddress, firmPhone, firmEmail] =
    landlordColumns(input);
  const now = nowIso();
  transaction(db, () => {
    db.prepare(
      `UPDATE landlords SET name = ?, email = ?, email_normalized = ?, phone = ?, notes = ?,
         id_type = ?, id_number = ?, law_firm_name = ?, law_firm_address = ?, law_firm_phone = ?,
         law_firm_email = ?, updated_at = ?
       WHERE id = ? AND workspace_id = ?`,
    ).run(
      name,
      email,
      normalized,
      phone,
      notes,
      idType,
      idNumber,
      firmName,
      firmAddress,
      firmPhone,
      firmEmail,
      now,
      current.id,
      input.workspaceId,
    );
    appendCaseEvent(db, {
      workspaceId: input.workspaceId,
      entityKind: "landlord",
      entityId: current.id,
      eventType: "landlord.updated",
      actorKind: "sender",
      actorId: input.actor.id,
      actorLabel: input.actor.label,
      metadata: { name, email },
    });
  });
  return getLandlord(db, input.workspaceId, current.id) as LandlordRow;
}

export function deleteLandlord(
  db: DatabaseSync,
  input: { workspaceId: string; landlordId: string; actor: { id: string; label: string } },
): void {
  const landlord = getLandlord(db, input.workspaceId, input.landlordId);
  if (!landlord) throw new NotFoundError("Landlord not found.");
  const properties = db
    .prepare("SELECT COUNT(*) AS count FROM properties WHERE landlord_id = ?")
    .get(landlord.id) as { count: number };
  if (Number(properties.count) > 0) {
    throw new ConflictError("Remove or reassign this landlord's properties before deleting the landlord.");
  }
  const files = db
    .prepare("SELECT storage_key FROM landlord_files WHERE landlord_id = ?")
    .all(landlord.id) as Array<{ storage_key: string }>;
  transaction(db, () => {
    db.prepare("DELETE FROM landlords WHERE id = ? AND workspace_id = ?").run(landlord.id, input.workspaceId);
    appendCaseEvent(db, {
      workspaceId: input.workspaceId,
      entityKind: "landlord",
      entityId: landlord.id,
      eventType: "landlord.deleted",
      actorKind: "sender",
      actorId: input.actor.id,
      actorLabel: input.actor.label,
      metadata: { name: landlord.name, email: landlord.email },
    });
  });
  for (const file of files) deleteStoredObject(file.storage_key);
}

export function listLandlordFiles(db: DatabaseSync, landlordId: string): LandlordFileRow[] {
  return plainRows<LandlordFileRow>(
    db.prepare("SELECT * FROM landlord_files WHERE landlord_id = ? ORDER BY created_at ASC").all(landlordId),
  );
}

export function addLandlordFile(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    landlordId: string;
    file: { bytes: Buffer; mediaType: string; filename: string };
    actor: { id: string; label: string };
  },
): LandlordFileRow {
  const landlord = getLandlord(db, input.workspaceId, input.landlordId);
  if (!landlord) throw new NotFoundError("Landlord not found.");
  validateIdFile(input.file);
  const extension =
    input.file.mediaType === "application/pdf" ? "pdf" : input.file.mediaType === "image/png" ? "png" : "jpg";
  const saved = saveBuffer(input.workspaceId, input.file.bytes, extension);
  const id = newId("lnf");
  const now = nowIso();
  db.prepare(
    `INSERT INTO landlord_files
      (id, landlord_id, kind, original_filename, mime, bytes, sha256, storage_key, created_at)
     VALUES (?, ?, 'id_document', ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    landlord.id,
    text(input.file.filename, 180, "id-document"),
    input.file.mediaType,
    saved.bytes,
    saved.sha256,
    saved.storageKey,
    now,
  );
  appendCaseEvent(db, {
    workspaceId: input.workspaceId,
    entityKind: "landlord",
    entityId: landlord.id,
    eventType: "landlord.document_uploaded",
    actorKind: "sender",
    actorId: input.actor.id,
    actorLabel: input.actor.label,
    metadata: { filename: input.file.filename },
  });
  return db.prepare("SELECT * FROM landlord_files WHERE id = ?").get(id) as unknown as LandlordFileRow;
}

export function deleteLandlordFile(
  db: DatabaseSync,
  input: { workspaceId: string; landlordId: string; fileId: string },
): void {
  const landlord = getLandlord(db, input.workspaceId, input.landlordId);
  if (!landlord) throw new NotFoundError("Landlord not found.");
  const file = db
    .prepare("SELECT * FROM landlord_files WHERE id = ? AND landlord_id = ?")
    .get(input.fileId, landlord.id) as unknown as LandlordFileRow | undefined;
  if (!file) throw new NotFoundError("Document not found.");
  db.prepare("DELETE FROM landlord_files WHERE id = ?").run(file.id);
  deleteStoredObject(file.storage_key);
}

export function getLandlordFile(
  db: DatabaseSync,
  workspaceId: string,
  landlordId: string,
  fileId: string,
): LandlordFileRow | undefined {
  const landlord = getLandlord(db, workspaceId, landlordId);
  if (!landlord) return undefined;
  return db
    .prepare("SELECT * FROM landlord_files WHERE id = ? AND landlord_id = ?")
    .get(fileId, landlord.id) as unknown as LandlordFileRow | undefined;
}

export function readLandlordFile(file: LandlordFileRow): Buffer {
  return readStoredObject(file.storage_key);
}

export function listProperties(db: DatabaseSync, workspaceId: string): PropertyListRow[] {
  const rows = db
    .prepare(
      `SELECT p.*, l.name AS landlord_name, l.email AS landlord_email,
        (SELECT COUNT(*) FROM inquiries i WHERE i.property_id = p.id) AS inquiry_count,
        (SELECT COUNT(*) FROM agreements a JOIN documents d ON d.id = a.document_id
          WHERE a.property_id = p.id AND d.status != 'VOIDED') AS active_tenants
       FROM properties p JOIN landlords l ON l.id = p.landlord_id
       WHERE p.workspace_id = ? ORDER BY p.created_at DESC`,
    )
    .all(workspaceId);
  return plainRows<PropertyListRow>(rows);
}

export function getProperty(
  db: DatabaseSync,
  workspaceId: string,
  propertyId: string,
): PropertyRow | undefined {
  return db
    .prepare("SELECT * FROM properties WHERE id = ? AND workspace_id = ?")
    .get(propertyId, workspaceId) as unknown as PropertyRow | undefined;
}

export interface PropertyInput {
  landlordId: string;
  reference?: string | null;
  name: string;
  category?: string;
  propertyType: string;
  description?: string | null;
  addressLine1: string;
  city: string;
  state: string;
  postalCode?: string | null;
  bedrooms: number;
  rentAmountCents: number;
  inquiryFeeCents?: number;
  status?: PropertyStatus;
}

const PROPERTY_CATEGORIES = ["Residential", "Office", "Retail", "Mixed"];

function propertyReference(db: DatabaseSync, workspaceId: string, name: string): string {
  const prefix = (name.replace(/[^a-z0-9]+/gi, "").slice(0, 3) || "PRP").toUpperCase();
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const candidate = `${prefix}-${suffix}`;
    const exists = db
      .prepare("SELECT id FROM properties WHERE workspace_id = ? AND reference = ?")
      .get(workspaceId, candidate);
    if (!exists) return candidate;
  }
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

export function createProperty(
  db: DatabaseSync,
  input: PropertyInput & {
    workspaceId: string;
    userId: string;
    userLabel: string;
  },
): PropertyRow {
  const landlord = getLandlord(db, input.workspaceId, input.landlordId);
  if (!landlord) throw new NotFoundError("Landlord not found.");
  const name = text(input.name, 120);
  const category = text(input.category, 40, "Residential");
  const propertyType = text(input.propertyType, 60, "Apartment");
  const addressLine1 = text(input.addressLine1, 200);
  const city = text(input.city, 80);
  const state = text(input.state, 80);
  if (name.length < 2) throw new ValidationError("Add a property name.");
  if (!PROPERTY_CATEGORIES.includes(category)) throw new ValidationError("Choose a valid property category.");
  if (!addressLine1) throw new ValidationError("Add the property address.");
  if (!city || !state) throw new ValidationError("Add the city and state.");
  const reference = (text(input.reference, 40) || propertyReference(db, input.workspaceId, name)).toUpperCase();
  const bedrooms = Math.max(0, Math.min(50, Math.round(input.bedrooms || 0)));
  const rent = Math.max(0, Math.min(100_000_000, Math.round(input.rentAmountCents || 0)));
  const inquiryFee = Math.max(0, Math.min(100_000_000, Math.round(input.inquiryFeeCents || 0)));
  const status = input.status ?? "available";
  if (!["available", "occupied", "maintenance", "archived"].includes(status)) {
    throw new ValidationError("Choose a valid property status.");
  }
  const exists = db
    .prepare("SELECT id FROM properties WHERE workspace_id = ? AND reference = ?")
    .get(input.workspaceId, reference);
  if (exists) throw new ConflictError("A property with this reference already exists.");
  const description = isoOrNull(input.description);
  const id = newId("prp");
  const now = nowIso();
  transaction(db, () => {
    db.prepare(
      `INSERT INTO properties
        (id, workspace_id, landlord_id, created_by, reference, name, category, property_type, description,
         unit_count, address_line1, city, state, postal_code, bedrooms, rent_amount_cents, inquiry_fee_cents,
         status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.workspaceId,
      landlord.id,
      input.userId,
      reference,
      name,
      category,
      propertyType,
      description,
      addressLine1,
      city,
      state,
      isoOrNull(input.postalCode),
      bedrooms,
      rent,
      inquiryFee,
      status,
      now,
      now,
    );
    appendCaseEvent(db, {
      workspaceId: input.workspaceId,
      entityKind: "property",
      entityId: id,
      eventType: "property.created",
      actorKind: "sender",
      actorId: input.userId,
      actorLabel: input.userLabel,
      metadata: { reference, name, category, landlordId: landlord.id },
    });
  });
  return getProperty(db, input.workspaceId, id) as PropertyRow;
}

export function updateProperty(
  db: DatabaseSync,
  input: PropertyInput & {
    workspaceId: string;
    propertyId: string;
    actor: { id: string; label: string };
  },
): PropertyRow {
  const current = getProperty(db, input.workspaceId, input.propertyId);
  if (!current) throw new NotFoundError("Property not found.");
  const landlord = getLandlord(db, input.workspaceId, input.landlordId);
  if (!landlord) throw new NotFoundError("Landlord not found.");
  const name = text(input.name, 120);
  const category = text(input.category, 40, "Residential");
  const propertyType = text(input.propertyType, 60, "Apartment");
  const addressLine1 = text(input.addressLine1, 200);
  const city = text(input.city, 80);
  const state = text(input.state, 80);
  if (name.length < 2) throw new ValidationError("Add a property name.");
  if (!PROPERTY_CATEGORIES.includes(category)) throw new ValidationError("Choose a valid property category.");
  if (!addressLine1) throw new ValidationError("Add the property address.");
  if (!city || !state) throw new ValidationError("Add the city and state.");
  const reference = text(input.reference, 40).toUpperCase() || current.reference;
  const duplicate = db
    .prepare("SELECT id FROM properties WHERE workspace_id = ? AND reference = ? AND id != ?")
    .get(input.workspaceId, reference, current.id);
  if (duplicate) throw new ConflictError("Another property already uses this reference.");
  const bedrooms = Math.max(0, Math.min(50, Math.round(input.bedrooms || 0)));
  const rent = Math.max(0, Math.min(100_000_000, Math.round(input.rentAmountCents || 0)));
  const inquiryFee = Math.max(
    0,
    Math.min(
      100_000_000,
      Math.round(input.inquiryFeeCents === undefined ? current.inquiry_fee_cents : input.inquiryFeeCents || 0),
    ),
  );
  const status = input.status ?? current.status;
  if (!["available", "occupied", "maintenance", "archived"].includes(status)) {
    throw new ValidationError("Choose a valid property status.");
  }
  const now = nowIso();
  transaction(db, () => {
    db.prepare(
      `UPDATE properties SET landlord_id = ?, reference = ?, name = ?, category = ?, property_type = ?,
         description = ?, address_line1 = ?, city = ?, state = ?, postal_code = ?, bedrooms = ?,
         rent_amount_cents = ?, inquiry_fee_cents = ?, status = ?, updated_at = ?
       WHERE id = ? AND workspace_id = ?`,
    ).run(
      landlord.id,
      reference,
      name,
      category,
      propertyType,
      isoOrNull(input.description),
      addressLine1,
      city,
      state,
      isoOrNull(input.postalCode),
      bedrooms,
      rent,
      inquiryFee,
      status,
      now,
      current.id,
      input.workspaceId,
    );
    appendCaseEvent(db, {
      workspaceId: input.workspaceId,
      entityKind: "property",
      entityId: current.id,
      eventType: "property.updated",
      actorKind: "sender",
      actorId: input.actor.id,
      actorLabel: input.actor.label,
      metadata: { reference, name, category },
    });
  });
  return getProperty(db, input.workspaceId, current.id) as PropertyRow;
}

export function deleteProperty(
  db: DatabaseSync,
  input: { workspaceId: string; propertyId: string; actor: { id: string; label: string } },
): void {
  const property = getProperty(db, input.workspaceId, input.propertyId);
  if (!property) throw new NotFoundError("Property not found.");
  const agreements = db
    .prepare("SELECT COUNT(*) AS count FROM agreements WHERE property_id = ?")
    .get(property.id) as { count: number };
  if (Number(agreements.count) > 0) {
    throw new ConflictError("This property has signed agreements on record and cannot be deleted.");
  }
  const files = db
    .prepare(
      `SELECT f.storage_key FROM unit_files f JOIN property_units u ON u.id = f.unit_id
       WHERE u.property_id = ?`,
    )
    .all(property.id) as Array<{ storage_key: string }>;
  const inquiryFiles = db
    .prepare(
      `SELECT f.storage_key FROM inquiry_files f JOIN inquiries i ON i.id = f.inquiry_id
       WHERE i.property_id = ?`,
    )
    .all(property.id) as Array<{ storage_key: string }>;
  transaction(db, () => {
    db.prepare("DELETE FROM properties WHERE id = ? AND workspace_id = ?").run(property.id, input.workspaceId);
    appendCaseEvent(db, {
      workspaceId: input.workspaceId,
      entityKind: "property",
      entityId: property.id,
      eventType: "property.deleted",
      actorKind: "sender",
      actorId: input.actor.id,
      actorLabel: input.actor.label,
      metadata: { name: property.name, reference: property.reference },
    });
  });
  for (const file of [...files, ...inquiryFiles]) deleteStoredObject(file.storage_key);
  if (property.image_storage_key) deleteStoredObject(property.image_storage_key);
}

const MAX_PROPERTY_IMAGE_BYTES = 5 * 1024 * 1024;

function validatePropertyImage(file: { bytes: Buffer; mediaType: string }): void {
  if (file.bytes.length === 0) throw new ValidationError("The selected image is empty.");
  if (file.bytes.length > MAX_PROPERTY_IMAGE_BYTES) {
    throw new ValidationError("Property images must be 5 MB or smaller.");
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.mediaType)) {
    throw new ValidationError("Upload a PNG, JPEG or WebP image.");
  }
  if (
    file.mediaType === "image/png" &&
    !file.bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    throw new ValidationError("That PNG could not be read. Upload a valid image.");
  }
  if (file.mediaType === "image/jpeg" && !(file.bytes[0] === 0xff && file.bytes[1] === 0xd8)) {
    throw new ValidationError("That JPEG could not be read. Upload a valid image.");
  }
  if (
    file.mediaType === "image/webp" &&
    !(
      file.bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
      file.bytes.subarray(8, 12).toString("latin1") === "WEBP"
    )
  ) {
    throw new ValidationError("That WebP image could not be read. Upload a valid image.");
  }
}

export function setPropertyImage(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    propertyId: string;
    file: { bytes: Buffer; mediaType: string; filename: string };
    actor: { id: string; label: string };
  },
): PropertyRow {
  const property = getProperty(db, input.workspaceId, input.propertyId);
  if (!property) throw new NotFoundError("Property not found.");
  validatePropertyImage(input.file);
  const extension =
    input.file.mediaType === "image/png" ? "png" : input.file.mediaType === "image/webp" ? "webp" : "jpg";
  const saved = saveBuffer(input.workspaceId, input.file.bytes, extension);
  const now = nowIso();
  transaction(db, () => {
    db.prepare(
      "UPDATE properties SET image_storage_key = ?, image_mime = ?, updated_at = ? WHERE id = ? AND workspace_id = ?",
    ).run(saved.storageKey, input.file.mediaType, now, property.id, input.workspaceId);
    appendCaseEvent(db, {
      workspaceId: input.workspaceId,
      entityKind: "property",
      entityId: property.id,
      eventType: "property.image_updated",
      actorKind: "sender",
      actorId: input.actor.id,
      actorLabel: input.actor.label,
      metadata: { filename: input.file.filename, bytes: saved.bytes },
    });
  });
  if (property.image_storage_key) deleteStoredObject(property.image_storage_key);
  return getProperty(db, input.workspaceId, property.id) as PropertyRow;
}

export function removePropertyImage(
  db: DatabaseSync,
  input: { workspaceId: string; propertyId: string; actor: { id: string; label: string } },
): PropertyRow {
  const property = getProperty(db, input.workspaceId, input.propertyId);
  if (!property) throw new NotFoundError("Property not found.");
  db.prepare(
    "UPDATE properties SET image_storage_key = NULL, image_mime = NULL, updated_at = ? WHERE id = ? AND workspace_id = ?",
  ).run(nowIso(), property.id, input.workspaceId);
  if (property.image_storage_key) deleteStoredObject(property.image_storage_key);
  appendCaseEvent(db, {
    workspaceId: input.workspaceId,
    entityKind: "property",
    entityId: property.id,
    eventType: "property.image_removed",
    actorKind: "sender",
    actorId: input.actor.id,
    actorLabel: input.actor.label,
    metadata: {},
  });
  return getProperty(db, input.workspaceId, property.id) as PropertyRow;
}

export function readPropertyImage(property: PropertyRow): { bytes: Buffer; mime: string } | null {
  if (!property.image_storage_key || !property.image_mime) return null;
  return { bytes: readStoredObject(property.image_storage_key), mime: property.image_mime };
}

export function listUnits(
  db: DatabaseSync,
  workspaceId: string,
  propertyId?: string,
): PropertyUnitListRow[] {
  const rows = propertyId
    ? db
        .prepare(
          `SELECT u.*, p.name AS property_name, p.reference AS property_reference,
            (SELECT COUNT(*) FROM inquiries i WHERE i.unit_id = u.id) AS inquiry_count
           FROM property_units u JOIN properties p ON p.id = u.property_id
           WHERE u.workspace_id = ? AND u.property_id = ?
           ORDER BY u.unit_number ASC`,
        )
        .all(workspaceId, propertyId)
    : db
        .prepare(
          `SELECT u.*, p.name AS property_name, p.reference AS property_reference,
            (SELECT COUNT(*) FROM inquiries i WHERE i.unit_id = u.id) AS inquiry_count
           FROM property_units u JOIN properties p ON p.id = u.property_id
           WHERE u.workspace_id = ?
           ORDER BY p.name ASC, u.unit_number ASC`,
        )
        .all(workspaceId);
  return plainRows<PropertyUnitListRow>(rows);
}

export function getUnit(
  db: DatabaseSync,
  workspaceId: string,
  unitId: string,
): PropertyUnitRow | undefined {
  return db
    .prepare("SELECT * FROM property_units WHERE id = ? AND workspace_id = ?")
    .get(unitId, workspaceId) as unknown as PropertyUnitRow | undefined;
}

export interface UnitInput {
  propertyId?: string;
  unitNumber: string;
  unitType: string;
  bedrooms: number;
  occupancyStatus?: UnitOccupancy;
  rentAmountCents: number;
  description?: string | null;
}

function unitValues(input: UnitInput): [string, string, number, UnitOccupancy, number, string | null] {
  const unitNumber = text(input.unitNumber, 40);
  const unitType = text(input.unitType, 60, "Standard");
  if (!unitNumber) throw new ValidationError("Add a unit name or number.");
  const bedrooms = Math.max(0, Math.min(50, Math.round(input.bedrooms || 0)));
  const occupancy = (input.occupancyStatus ?? "available") as UnitOccupancy;
  if (!["available", "occupied", "maintenance"].includes(occupancy)) {
    throw new ValidationError("Choose a valid occupancy status.");
  }
  const rent = Math.max(0, Math.min(100_000_000, Math.round(input.rentAmountCents || 0)));
  return [unitNumber, unitType, bedrooms, occupancy, rent, isoOrNull(input.description)];
}

function refreshUnitCount(db: DatabaseSync, propertyId: string): void {
  db.prepare(
    "UPDATE properties SET unit_count = (SELECT COUNT(*) FROM property_units WHERE property_id = ?), updated_at = ? WHERE id = ?",
  ).run(propertyId, nowIso(), propertyId);
}

export function createUnit(
  db: DatabaseSync,
  input: UnitInput & {
    workspaceId: string;
    propertyId: string;
    actor: { id: string; label: string };
  },
): PropertyUnitRow {
  const property = getProperty(db, input.workspaceId, input.propertyId);
  if (!property) throw new NotFoundError("Property not found.");
  const [unitNumber, unitType, bedrooms, occupancy, rent, description] = unitValues(input);
  const duplicate = db
    .prepare("SELECT id FROM property_units WHERE property_id = ? AND unit_number = ?")
    .get(property.id, unitNumber);
  if (duplicate) throw new ConflictError("A unit with this name or number already exists in the property.");
  const id = newId("unt");
  const now = nowIso();
  transaction(db, () => {
    db.prepare(
      `INSERT INTO property_units
        (id, workspace_id, property_id, unit_number, unit_type, bedrooms, occupancy_status,
         rent_amount_cents, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.workspaceId,
      property.id,
      unitNumber,
      unitType,
      bedrooms,
      occupancy,
      rent,
      description,
      now,
      now,
    );
    refreshUnitCount(db, property.id);
    appendCaseEvent(db, {
      workspaceId: input.workspaceId,
      entityKind: "unit",
      entityId: id,
      eventType: "unit.created",
      actorKind: "sender",
      actorId: input.actor.id,
      actorLabel: input.actor.label,
      metadata: { propertyId: property.id, unitNumber },
    });
  });
  return getUnit(db, input.workspaceId, id) as PropertyUnitRow;
}

export function createUnitsBulk(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    propertyId: string;
    units: UnitInput[];
    actor: { id: string; label: string };
  },
): PropertyUnitRow[] {
  const property = getProperty(db, input.workspaceId, input.propertyId);
  if (!property) throw new NotFoundError("Property not found.");
  if (input.units.length === 0) throw new ValidationError("Add at least one unit.");
  if (input.units.length > 100) throw new ValidationError("Add no more than 100 units at a time.");
  const created: PropertyUnitRow[] = [];
  for (const unit of input.units) {
    created.push(createUnit(db, { ...unit, workspaceId: input.workspaceId, propertyId: property.id, actor: input.actor }));
  }
  return created;
}

export function updateUnit(
  db: DatabaseSync,
  input: UnitInput & {
    workspaceId: string;
    unitId: string;
    actor: { id: string; label: string };
  },
): PropertyUnitRow {
  const current = getUnit(db, input.workspaceId, input.unitId);
  if (!current) throw new NotFoundError("Unit not found.");
  const [unitNumber, unitType, bedrooms, occupancy, rent, description] = unitValues(input);
  const duplicate = db
    .prepare("SELECT id FROM property_units WHERE property_id = ? AND unit_number = ? AND id != ?")
    .get(current.property_id, unitNumber, current.id);
  if (duplicate) throw new ConflictError("Another unit already uses this name or number.");
  const now = nowIso();
  db.prepare(
    `UPDATE property_units SET unit_number = ?, unit_type = ?, bedrooms = ?, occupancy_status = ?,
       rent_amount_cents = ?, description = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ?`,
  ).run(
    unitNumber,
    unitType,
    bedrooms,
    occupancy,
    rent,
    description,
    now,
    current.id,
    input.workspaceId,
  );
  appendCaseEvent(db, {
    workspaceId: input.workspaceId,
    entityKind: "unit",
    entityId: current.id,
    eventType: "unit.updated",
    actorKind: "sender",
    actorId: input.actor.id,
    actorLabel: input.actor.label,
    metadata: { propertyId: current.property_id, unitNumber },
  });
  return getUnit(db, input.workspaceId, current.id) as PropertyUnitRow;
}

export function deleteUnit(
  db: DatabaseSync,
  input: { workspaceId: string; unitId: string; actor: { id: string; label: string } },
): void {
  const unit = getUnit(db, input.workspaceId, input.unitId);
  if (!unit) throw new NotFoundError("Unit not found.");
  const files = db
    .prepare("SELECT storage_key FROM unit_files WHERE unit_id = ?")
    .all(unit.id) as Array<{ storage_key: string }>;
  const now = nowIso();
  transaction(db, () => {
    db.prepare("DELETE FROM property_units WHERE id = ? AND workspace_id = ?").run(unit.id, input.workspaceId);
    refreshUnitCount(db, unit.property_id);
    appendCaseEvent(db, {
      workspaceId: input.workspaceId,
      entityKind: "unit",
      entityId: unit.id,
      eventType: "unit.deleted",
      actorKind: "sender",
      actorId: input.actor.id,
      actorLabel: input.actor.label,
      metadata: { propertyId: unit.property_id, unitNumber: unit.unit_number, at: now },
    });
  });
  for (const file of files) deleteStoredObject(file.storage_key);
}

export function listUnitFiles(db: DatabaseSync, unitId: string): UnitFileRow[] {
  return plainRows<UnitFileRow>(
    db.prepare("SELECT * FROM unit_files WHERE unit_id = ? ORDER BY created_at ASC").all(unitId),
  );
}

export function addUnitFile(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    unitId: string;
    file: { bytes: Buffer; mediaType: string; filename: string };
    actor: { id: string; label: string };
  },
): UnitFileRow {
  const unit = getUnit(db, input.workspaceId, input.unitId);
  if (!unit) throw new NotFoundError("Unit not found.");
  if (input.file.bytes.length === 0) throw new ValidationError("The selected file is empty.");
  if (input.file.bytes.length > MAX_ID_BYTES) throw new ValidationError("Files must be 5 MB or smaller.");
  if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(input.file.mediaType)) {
    throw new ValidationError("Upload a PDF, PNG, JPEG or WebP file.");
  }
  const extension =
    input.file.mediaType === "application/pdf"
      ? "pdf"
      : input.file.mediaType === "image/png"
        ? "png"
        : input.file.mediaType === "image/webp"
          ? "webp"
          : "jpg";
  const saved = saveBuffer(input.workspaceId, input.file.bytes, extension);
  const id = newId("unf");
  const now = nowIso();
  db.prepare(
    `INSERT INTO unit_files
      (id, unit_id, kind, original_filename, mime, bytes, sha256, storage_key, created_at)
     VALUES (?, ?, 'attachment', ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    unit.id,
    text(input.file.filename, 180, "unit-file"),
    input.file.mediaType,
    saved.bytes,
    saved.sha256,
    saved.storageKey,
    now,
  );
  appendCaseEvent(db, {
    workspaceId: input.workspaceId,
    entityKind: "unit",
    entityId: unit.id,
    eventType: "unit.file_uploaded",
    actorKind: "sender",
    actorId: input.actor.id,
    actorLabel: input.actor.label,
    metadata: { filename: input.file.filename },
  });
  return db.prepare("SELECT * FROM unit_files WHERE id = ?").get(id) as unknown as UnitFileRow;
}

export function deleteUnitFile(
  db: DatabaseSync,
  input: { workspaceId: string; unitId: string; fileId: string },
): void {
  const unit = getUnit(db, input.workspaceId, input.unitId);
  if (!unit) throw new NotFoundError("Unit not found.");
  const file = db
    .prepare("SELECT * FROM unit_files WHERE id = ? AND unit_id = ?")
    .get(input.fileId, unit.id) as unknown as UnitFileRow | undefined;
  if (!file) throw new NotFoundError("File not found.");
  db.prepare("DELETE FROM unit_files WHERE id = ?").run(file.id);
  deleteStoredObject(file.storage_key);
}

export function getUnitFile(
  db: DatabaseSync,
  workspaceId: string,
  unitId: string,
  fileId: string,
): UnitFileRow | undefined {
  const unit = getUnit(db, workspaceId, unitId);
  if (!unit) return undefined;
  return db
    .prepare("SELECT * FROM unit_files WHERE id = ? AND unit_id = ?")
    .get(fileId, unit.id) as unknown as UnitFileRow | undefined;
}

export function readUnitFile(file: UnitFileRow): Buffer {
  return readStoredObject(file.storage_key);
}

export function listInquiries(db: DatabaseSync, workspaceId: string): InquiryListRow[] {
  const rows = db
    .prepare(
      `SELECT i.*, p.name AS property_name, p.reference AS property_reference,
        u.unit_number AS unit_number, l.name AS landlord_name,
        (SELECT COUNT(*) FROM guarantors g WHERE g.inquiry_id = i.id) AS guarantor_count,
        (SELECT COUNT(*) FROM agreements a WHERE a.inquiry_id = i.id) AS agreement_count
       FROM inquiries i
       JOIN properties p ON p.id = i.property_id
       LEFT JOIN property_units u ON u.id = i.unit_id
       JOIN landlords l ON l.id = i.landlord_id
       WHERE i.workspace_id = ?
       ORDER BY i.updated_at DESC`,
    )
    .all(workspaceId);
  return plainRows<InquiryListRow>(rows);
}

export function getInquiry(
  db: DatabaseSync,
  workspaceId: string,
  inquiryId: string,
): InquiryDetail {
  const inquiry = db
    .prepare("SELECT * FROM inquiries WHERE id = ? AND workspace_id = ?")
    .get(inquiryId, workspaceId) as unknown as InquiryRow | undefined;
  if (!inquiry) throw new NotFoundError("Inquiry not found.");
  const property = getProperty(db, workspaceId, inquiry.property_id);
  const landlord = getLandlord(db, workspaceId, inquiry.landlord_id);
  if (!property || !landlord) throw new NotFoundError("The property or landlord for this inquiry no longer exists.");
  const unit = inquiry.unit_id ? getUnit(db, workspaceId, inquiry.unit_id) : undefined;
  const agreement = db
    .prepare("SELECT id, document_id FROM agreements WHERE inquiry_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(inquiry.id) as { id: string; document_id: string } | undefined;
  return {
    inquiry: { ...inquiry },
    property: { ...property },
    unit: unit ? { ...unit } : null,
    landlord: { ...landlord },
    guarantors: listGuarantors(db, inquiry.id),
    files: listInquiryFiles(db, inquiry.id),
    agreement: agreement ? { ...agreement } : null,
  };
}

export function listGuarantors(db: DatabaseSync, inquiryId: string): GuarantorRow[] {
  const rows = db
    .prepare("SELECT * FROM guarantors WHERE inquiry_id = ? ORDER BY created_at ASC")
    .all(inquiryId);
  return plainRows<GuarantorRow>(rows);
}

export function listInquiryFiles(db: DatabaseSync, inquiryId: string): InquiryFileRow[] {
  const rows = db
    .prepare("SELECT * FROM inquiry_files WHERE inquiry_id = ? ORDER BY created_at ASC")
    .all(inquiryId);
  return plainRows<InquiryFileRow>(rows);
}

export function createInquiry(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    userId: string;
    userLabel: string;
    propertyId: string;
    unitId?: string | null;
    applicantName: string;
    applicantEmail: string;
    applicantPhone: string;
    lawyerNote?: string | null;
    inquiryFeeCents?: number | null;
  },
): { inquiry: InquiryRow; link: string } {
  const property = getProperty(db, input.workspaceId, input.propertyId);
  if (!property) throw new NotFoundError("Property not found.");
  if (input.unitId) {
    const unit = getUnit(db, input.workspaceId, input.unitId);
    if (!unit || unit.property_id !== property.id) {
      throw new ValidationError("Choose a unit that belongs to this property.");
    }
  }
  const name = text(input.applicantName, 120);
  const email = text(input.applicantEmail, 254);
  const phone = text(input.applicantPhone, 40);
  if (name.length < 2) throw new ValidationError("Enter the applicant's full name.");
  if (!isValidEmail(email)) throw new ValidationError("Enter a valid applicant email address.");
  if (phone.length < 5) throw new ValidationError("Enter an applicant phone number.");
  if (
    input.inquiryFeeCents !== undefined &&
    input.inquiryFeeCents !== null &&
    (!Number.isFinite(input.inquiryFeeCents) ||
      input.inquiryFeeCents < 0 ||
      input.inquiryFeeCents > MAX_INQUIRY_FEE_CENTS)
  ) {
    throw new ValidationError("Enter an inquiry fee of ₦1,000,000 or less, or 0 to waive it.");
  }
  const feeCents =
    input.inquiryFeeCents === undefined || input.inquiryFeeCents === null
      ? null
      : Math.round(input.inquiryFeeCents);
  const effectiveFeeCents = clampInquiryFeeCents(feeCents ?? property.inquiry_fee_cents);
  const id = newId("inq");
  const now = nowIso();
  const token = newToken(32);
  const expiresAt = addDaysIso(INQUIRY_TOKEN_DAYS);
  transaction(db, () => {
    db.prepare(
      `INSERT INTO inquiries
        (id, workspace_id, property_id, unit_id, landlord_id, created_by, applicant_name, applicant_email,
         applicant_email_normalized, applicant_phone, status, tenant_token_hash, tenant_token_expires_at,
         lawyer_note, inquiry_fee_cents, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.workspaceId,
      property.id,
      input.unitId ?? null,
      property.landlord_id,
      input.userId,
      name,
      email,
      normalizeEmail(email),
      phone,
      hashToken(token),
      expiresAt,
      isoOrNull(input.lawyerNote),
      feeCents,
      now,
      now,
    );
    appendCaseEvent(db, {
      workspaceId: input.workspaceId,
      entityKind: "inquiry",
      entityId: id,
      eventType: "inquiry.created",
      actorKind: "sender",
      actorId: input.userId,
      actorLabel: input.userLabel,
      metadata: {
        propertyId: property.id,
        unitId: input.unitId ?? null,
        applicantEmail: normalizeEmail(email),
        inquiryFeeCents: effectiveFeeCents,
      },
    });
  });
  const link = appLink(`/inquiry/${token}`);
  const workspace = db
    .prepare("SELECT name, brand_display_name FROM workspaces WHERE id = ?")
    .get(input.workspaceId) as { name: string; brand_display_name: string | null } | undefined;
  queueEmail(db, {
    kind: "inquiry_invitation",
    to: email,
    workspaceId: input.workspaceId,
    subject: `Tenant inquiry for ${property.name}`,
    heading: "Please complete your tenant inquiry",
    intro: [
      `${input.userLabel} invited you to complete a tenant inquiry for ${property.name} in ${cityLabel(property)}.`,
      `The form asks for your contact details, current address, household, employment and income range. It should take about eight minutes.`,
      effectiveFeeCents > 0
        ? `A ${formatMoney(effectiveFeeCents)} inquiry fee is payable by card when you submit the form.`
        : "",
      `This link expires on ${expiryLabel(expiresAt)}.`,
    ].filter(Boolean),
    cta: { label: "Open the inquiry form", url: link },
    footnote:
      "Juripass does not verify the information you provide. The landlord and their lawyer may make further enquiries.",
    meta: { inquiryId: id, propertyId: property.id, link },
  });
  return { inquiry: db.prepare("SELECT * FROM inquiries WHERE id = ?").get(id) as unknown as InquiryRow, link };
}

function cityLabel(property: PropertyRow): string {
  return [property.city, property.state].filter(Boolean).join(", ");
}

function expiryLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function resendInquiry(
  db: DatabaseSync,
  input: { workspaceId: string; inquiryId: string; actor: { id: string; label: string } },
): { link: string; expiresAt: string } {
  const detail = getInquiry(db, input.workspaceId, input.inquiryId);
  if (!["DRAFT", "SUBMITTED"].includes(detail.inquiry.status)) {
    throw new ConflictError("This inquiry has already moved past the tenant form.");
  }
  if (detail.inquiry.status === "SUBMITTED") {
    throw new ConflictError("The tenant has already submitted this inquiry.");
  }
  const token = newToken(32);
  const expiresAt = addDaysIso(INQUIRY_TOKEN_DAYS);
  db.prepare(
    "UPDATE inquiries SET tenant_token_hash = ?, tenant_token_expires_at = ?, updated_at = ? WHERE id = ?",
  ).run(hashToken(token), expiresAt, nowIso(), detail.inquiry.id);
  appendCaseEvent(db, {
    workspaceId: input.workspaceId,
    entityKind: "inquiry",
    entityId: detail.inquiry.id,
    eventType: "inquiry.form_resent",
    actorKind: "sender",
    actorId: input.actor.id,
    actorLabel: input.actor.label,
    metadata: { email: detail.inquiry.applicant_email },
  });
  const link = appLink(`/inquiry/${token}`);
  queueEmail(db, {
    kind: "inquiry_invitation",
    to: detail.inquiry.applicant_email,
    workspaceId: input.workspaceId,
    subject: `Reminder: tenant inquiry for ${detail.property.name}`,
    heading: "Your tenant inquiry is still waiting",
    intro: [
      `${input.actor.label} resent the inquiry form for ${detail.property.name}.`,
      `This fresh link expires on ${expiryLabel(expiresAt)}.`,
    ],
    cta: { label: "Complete the inquiry", url: link },
    meta: { inquiryId: detail.inquiry.id, link },
  });
  return { link, expiresAt };
}

export function updateInquiry(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    inquiryId: string;
    name: string;
    email: string;
    phone: string;
    unitId?: string | null;
    lawyerNote?: string | null;
    inquiryFeeCents?: number | null;
    actor: { id: string; label: string };
  },
): InquiryRow {
  const detail = getInquiry(db, input.workspaceId, input.inquiryId);
  if (!["DRAFT", "SUBMITTED"].includes(detail.inquiry.status)) {
    throw new ConflictError("Only a draft or submitted inquiry can be edited.");
  }
  let feeCents = detail.inquiry.inquiry_fee_cents;
  if (input.inquiryFeeCents !== undefined) {
    if (detail.inquiry.status !== "DRAFT") {
      throw new ConflictError("The inquiry fee can only change while the form is still a draft.");
    }
    if (
      input.inquiryFeeCents === null ||
      !Number.isFinite(input.inquiryFeeCents) ||
      input.inquiryFeeCents < 0 ||
      input.inquiryFeeCents > MAX_INQUIRY_FEE_CENTS
    ) {
      throw new ValidationError("Enter an inquiry fee of ₦1,000,000 or less, or 0 to waive it.");
    }
    feeCents = Math.round(input.inquiryFeeCents);
  }
  const name = text(input.name, 120);
  const email = text(input.email, 254);
  const phone = text(input.phone, 40);
  if (name.length < 2) throw new ValidationError("Enter the applicant's full name.");
  if (!isValidEmail(email)) throw new ValidationError("Enter a valid applicant email address.");
  if (phone.length < 5) throw new ValidationError("Enter an applicant phone number.");
  let unitId = detail.inquiry.unit_id;
  if (input.unitId !== undefined) {
    if (input.unitId) {
      const unit = getUnit(db, input.workspaceId, input.unitId);
      if (!unit || unit.property_id !== detail.property.id) {
        throw new ValidationError("Choose a unit that belongs to this property.");
      }
      unitId = unit.id;
    } else {
      unitId = null;
    }
  }
  const now = nowIso();
  db.prepare(
    `UPDATE inquiries SET applicant_name = ?, applicant_email = ?, applicant_email_normalized = ?,
       applicant_phone = ?, unit_id = ?, lawyer_note = ?, inquiry_fee_cents = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ?`,
  ).run(
    name,
    email,
    normalizeEmail(email),
    phone,
    unitId,
    input.lawyerNote === undefined ? detail.inquiry.lawyer_note : isoOrNull(input.lawyerNote),
    feeCents,
    now,
    detail.inquiry.id,
    input.workspaceId,
  );
  appendCaseEvent(db, {
    workspaceId: input.workspaceId,
    entityKind: "inquiry",
    entityId: detail.inquiry.id,
    eventType: "inquiry.updated",
    actorKind: "sender",
    actorId: input.actor.id,
    actorLabel: input.actor.label,
    metadata: { name, email, unitId, inquiryFeeCents: feeCents },
  });
  return { ...(db.prepare("SELECT * FROM inquiries WHERE id = ?").get(detail.inquiry.id) as object) } as InquiryRow;
}

export function deleteInquiry(
  db: DatabaseSync,
  input: { workspaceId: string; inquiryId: string; actor: { id: string; label: string } },
): void {
  const detail = getInquiry(db, input.workspaceId, input.inquiryId);
  if (detail.agreement) {
    throw new ConflictError("Void the agreement before deleting this inquiry.");
  }
  const files = db
    .prepare("SELECT storage_key FROM inquiry_files WHERE inquiry_id = ?")
    .all(detail.inquiry.id) as Array<{ storage_key: string }>;
  transaction(db, () => {
    db.prepare("DELETE FROM inquiries WHERE id = ? AND workspace_id = ?").run(
      detail.inquiry.id,
      input.workspaceId,
    );
    appendCaseEvent(db, {
      workspaceId: input.workspaceId,
      entityKind: "inquiry",
      entityId: detail.inquiry.id,
      eventType: "inquiry.deleted",
      actorKind: "sender",
      actorId: input.actor.id,
      actorLabel: input.actor.label,
      metadata: { applicant: detail.inquiry.applicant_name, property: detail.property.name },
    });
  });
  for (const file of files) deleteStoredObject(file.storage_key);
}

export type PublicInquiryLookup =
  | { ok: true; context: InquiryContext }
  | { ok: false; reason: "invalid" | "expired" | "not_found" };

export function getInquiryByTenantToken(db: DatabaseSync, rawToken: string): PublicInquiryLookup {
  if (!rawToken || rawToken.length < 20 || rawToken.length > 400) {
    return { ok: false, reason: "invalid" };
  }
  const inquiry = db
    .prepare("SELECT * FROM inquiries WHERE tenant_token_hash = ?")
    .get(hashToken(rawToken)) as unknown as InquiryRow | undefined;
  if (!inquiry) return { ok: false, reason: "invalid" };
  if (inquiry.tenant_token_expires_at && new Date(inquiry.tenant_token_expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return buildInquiryContext(db, inquiry);
}

function buildInquiryContext(db: DatabaseSync, inquiry: InquiryRow): PublicInquiryLookup {
  const property = db
    .prepare("SELECT * FROM properties WHERE id = ? AND workspace_id = ?")
    .get(inquiry.property_id, inquiry.workspace_id) as unknown as PropertyRow | undefined;
  const landlord = db
    .prepare("SELECT * FROM landlords WHERE id = ? AND workspace_id = ?")
    .get(inquiry.landlord_id, inquiry.workspace_id) as unknown as LandlordRow | undefined;
  const workspace = db
    .prepare("SELECT id, name, brand_display_name, plan FROM workspaces WHERE id = ?")
    .get(inquiry.workspace_id) as
    | { id: string; name: string; brand_display_name: string | null; plan: string }
    | undefined;
  if (!property || !landlord || !workspace) return { ok: false, reason: "not_found" };
  const unit = inquiry.unit_id
    ? (db
        .prepare("SELECT * FROM property_units WHERE id = ? AND workspace_id = ?")
        .get(inquiry.unit_id, inquiry.workspace_id) as unknown as PropertyUnitRow | undefined)
    : undefined;
  return {
    ok: true,
    context: {
      inquiry,
      property,
      unit: unit ?? null,
      landlord,
      workspace,
      guarantors: listGuarantors(db, inquiry.id),
      files: listInquiryFiles(db, inquiry.id),
    },
  };
}

function validateIdFile(file: { bytes: Buffer; mediaType: string; filename: string }): void {
  if (file.bytes.length === 0) throw new ValidationError("The selected file is empty.");
  if (file.bytes.length > MAX_ID_BYTES) {
    throw new ValidationError("The ID document must be 5 MB or smaller.");
  }
  if (!["application/pdf", "image/png", "image/jpeg"].includes(file.mediaType)) {
    throw new ValidationError("Upload a PDF, PNG or JPEG ID document.");
  }
  if (
    file.mediaType === "application/pdf" &&
    file.bytes.subarray(0, 5).toString("latin1") !== "%PDF-"
  ) {
    throw new ValidationError("That PDF could not be read. Upload a valid PDF.");
  }
  if (file.mediaType === "image/png" && !file.bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new ValidationError("That PNG could not be read. Upload a valid image.");
  }
  if (file.mediaType === "image/jpeg" && !(file.bytes[0] === 0xff && file.bytes[1] === 0xd8)) {
    throw new ValidationError("That JPEG could not be read. Upload a valid image.");
  }
}

function validatePassportPhoto(file: { bytes: Buffer; mediaType: string; filename: string }): void {
  if (file.bytes.length === 0) throw new ValidationError("The passport photo is empty.");
  if (file.bytes.length > MAX_PASSPORT_BYTES) {
    throw new ValidationError("The passport photo must be 2 MB or smaller.");
  }
  if (!["image/png", "image/jpeg"].includes(file.mediaType)) {
    throw new ValidationError("Upload the passport photo as a PNG or JPEG image.");
  }
  if (
    file.mediaType === "image/png" &&
    !file.bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    throw new ValidationError("That PNG could not be read. Upload a valid image.");
  }
  if (file.mediaType === "image/jpeg" && !(file.bytes[0] === 0xff && file.bytes[1] === 0xd8)) {
    throw new ValidationError("That JPEG could not be read. Upload a valid image.");
  }
}

export function parsePassportPhotoDataUrl(dataUrl: string): {
  bytes: Buffer;
  mediaType: string;
  filename: string;
} {
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new ValidationError("Upload the passport photo as a PNG or JPEG image.");
  const mediaType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > MAX_PASSPORT_BYTES) {
    throw new ValidationError("The passport photo must be 2 MB or smaller.");
  }
  const photo = {
    bytes,
    mediaType,
    filename: mediaType === "image/png" ? "passport-photo.png" : "passport-photo.jpg",
  };
  validatePassportPhoto(photo);
  return photo;
}

export async function submitInquiry(
  db: DatabaseSync,
  input: {
    rawToken: string;
    submission: InquirySubmission;
    passportPhoto?: { bytes: Buffer; mediaType: string; filename: string } | null;
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<{
  inquiryId: string;
  payment: { authorizationUrl: string; reference: string; amountCents: number } | null;
}> {
  const lookup = getInquiryByTenantToken(db, input.rawToken);
  if (!lookup.ok) throw new ConflictError("This inquiry link is no longer available.");
  const { inquiry, property, workspace } = lookup.context;
  if (inquiry.status !== "DRAFT") {
    throw new ConflictError("This inquiry has already been submitted.");
  }
  const details = input.submission;
  const currentAddress = text(details.currentAddress, 400);
  const reason = text(details.reasonForMoving, 600);
  const marital = text(details.maritalStatus, 60);
  const employment = text(details.employmentStatus, 80);
  const income = text(details.incomeRange, 80);
  const signatureName = text(details.signatureName, 120);
  if (currentAddress.length < 5) throw new ValidationError("Enter your current address.");
  if (signatureName.length < 2) throw new ValidationError("Type your full name to confirm the inquiry.");
  if (details.reasonForMoving && reason.length < 5) throw new ValidationError("Tell us why you are moving.");
  let unitId = inquiry.unit_id;
  if (details.unitId) {
    const unit = getUnit(db, inquiry.workspace_id, details.unitId);
    if (!unit || unit.property_id !== property.id) {
      throw new ValidationError("Choose a unit that belongs to this property.");
    }
    unitId = unit.id;
  }
  const children = marital === "Single" ? 0 : Math.max(0, Math.min(20, Math.round(details.childrenCount || 0)));
  const occupants = Math.max(0, Math.min(30, Math.round(details.occupantsCount ?? children)));
  const dependents = Math.max(0, Math.min(30, Math.round(details.dependentsCount ?? 0)));
  const bedroomsRequired = Math.max(0, Math.min(20, Math.round(details.bedroomsRequired ?? 0)));
  const declaration = details.declarationAccepted === false ? 0 : 1;
  const guarantors = (details.guarantors || [])
    .map((guarantor) => ({
      name: text(guarantor.name, 120),
      email: text(guarantor.email, 254),
      relationship: text(guarantor.relationship, 60),
    }))
    .filter((guarantor) => guarantor.name || guarantor.email);
  if (guarantors.length > 2) throw new ValidationError("Add no more than two guarantors.");
  for (const guarantor of guarantors) {
    if (guarantor.name.length < 2) throw new ValidationError("Enter the guarantor's full name.");
    if (!isValidEmail(guarantor.email)) throw new ValidationError("Enter a valid guarantor email address.");
    if (!guarantor.relationship) throw new ValidationError("Select the guarantor's relationship.");
  }
  if (input.passportPhoto) validatePassportPhoto(input.passportPhoto);

  const feeCents = inquiryFeeCentsFor(inquiry, property);
  let paymentReference: string | null = null;
  let paymentUrl: string | null = null;
  let payment: { authorizationUrl: string; reference: string; amountCents: number } | null = null;
  if (feeCents > 0) {
    const draftReference = `JUR-${inquiry.id.replace(/[^A-Za-z0-9]/g, "").slice(-18)}-${Date.now()
      .toString(36)
      .toUpperCase()}`;
    const authorization = await initializePaystackTransaction({
      email: inquiry.applicant_email,
      amountCents: feeCents,
      reference: draftReference,
      callbackUrl: appLink(`/inquiry/${encodeURIComponent(input.rawToken)}/payment/callback`),
      metadata: {
        inquiryId: inquiry.id,
        propertyId: property.id,
        workspaceId: inquiry.workspace_id,
        applicant: inquiry.applicant_name,
      },
    });
    paymentReference = authorization.reference;
    paymentUrl = authorization.authorizationUrl;
    payment = {
      authorizationUrl: authorization.authorizationUrl,
      reference: authorization.reference,
      amountCents: feeCents,
    };
  }

  let fileRow: { id: string; saved: ReturnType<typeof saveBuffer> } | null = null;
  if (input.passportPhoto) {
    const extension =
      input.passportPhoto.mediaType === "image/png"
        ? "png"
        : "jpg";
    fileRow = { id: newId("inf"), saved: saveBuffer(workspace.id, input.passportPhoto.bytes, extension) };
  }
  const now = nowIso();
  transaction(db, () => {
    const changed = db
      .prepare(
        `UPDATE inquiries SET unit_id = ?, current_address = ?, current_city = ?, current_state = ?,
           reason_for_moving = ?, marital_status = ?, children_count = ?, employment_status = ?, employer = ?,
           occupation = ?, employment_address = ?, income_range = ?, religion_state = ?,
           occupants_count = ?, dependents_count = ?, bedrooms_required = ?, state_of_origin = ?,
           additional_info = ?, declaration_accepted = ?, notes = ?, signature_name = ?, status = 'SUBMITTED',
           payment_status = ?, payment_reference = ?, payment_url = ?, payment_fee_cents = ?,
           submitted_at = ?, updated_at = ?
         WHERE id = ? AND status = 'DRAFT'`,
      )
      .run(
        unitId,
        currentAddress,
        isoOrNull(details.currentCity),
        isoOrNull(details.currentState),
        isoOrNull(details.reasonForMoving),
        isoOrNull(details.maritalStatus),
        children,
        isoOrNull(details.employmentStatus),
        isoOrNull(details.employer),
        isoOrNull(details.occupation),
        isoOrNull(details.employmentAddress),
        isoOrNull(details.incomeRange),
        isoOrNull(details.religionState),
        occupants,
        dependents,
        bedroomsRequired,
        isoOrNull(details.stateOfOrigin),
        isoOrNull(details.additionalInfo || details.notes),
        declaration,
        isoOrNull(details.additionalInfo ? details.notes : null),
        signatureName,
        feeCents > 0 ? "pending" : "not_required",
        paymentReference,
        paymentUrl,
        feeCents,
        now,
        now,
        inquiry.id,
      ).changes;
    if (!changed) throw new ConflictError("This inquiry has already been submitted.");
    for (const guarantor of guarantors) {
      db.prepare(
        `INSERT INTO guarantors
          (id, inquiry_id, name, email, email_normalized, relationship, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      ).run(
        newId("gtr"),
        inquiry.id,
        guarantor.name,
        guarantor.email,
        normalizeEmail(guarantor.email),
        guarantor.relationship,
        now,
        now,
      );
    }
    if (fileRow && input.passportPhoto) {
      db.prepare(
        `INSERT INTO inquiry_files
          (id, inquiry_id, kind, original_filename, mime, bytes, sha256, storage_key, created_at)
         VALUES (?, ?, 'passport_photo', ?, ?, ?, ?, ?, ?)`,
      ).run(
        fileRow.id,
        inquiry.id,
        text(input.passportPhoto.filename, 180, "passport-photo"),
        input.passportPhoto.mediaType,
        fileRow.saved.bytes,
        fileRow.saved.sha256,
        fileRow.saved.storageKey,
        now,
      );
    }
    appendCaseEvent(db, {
      workspaceId: inquiry.workspace_id,
      entityKind: "inquiry",
      entityId: inquiry.id,
      eventType: "inquiry.submitted",
      actorKind: "public",
      actorId: inquiry.id,
      actorLabel: inquiry.applicant_name,
      metadata: {
        propertyId: property.id,
        guarantors: guarantors.length,
        passportPhoto: Boolean(fileRow),
        paymentFeeCents: feeCents,
        paymentReference,
        ip: input.ip ?? null,
      },
    });
    appendAuditEvent(db, {
      documentId: inquiry.id,
      workspaceId: inquiry.workspace_id,
      eventType: "inquiry.submitted",
      actorKind: "public",
      actorId: inquiry.id,
      actorLabel: inquiry.applicant_name,
      metadata: { source: "tenant_form", guarantors: guarantors.length, paymentFeeCents: feeCents },
    });
  });

  const lawyer = db
    .prepare("SELECT full_name, email FROM users WHERE id = ?")
    .get(inquiry.created_by) as { full_name: string; email: string } | undefined;
  if (lawyer) {
    queueEmail(db, {
      kind: "inquiry_submitted",
      to: lawyer.email,
      workspaceId: inquiry.workspace_id,
      subject: `Tenant inquiry submitted: ${inquiry.applicant_name}`,
      heading: "A tenant inquiry is ready for review",
      intro: [
        `${inquiry.applicant_name} submitted an inquiry for ${property.name}.`,
        feeCents > 0 && payment
          ? `The applicant was asked to pay the ${formatMoney(feeCents)} inquiry fee through Paystack. The payment status is shown on the inquiry page.`
          : "Review the details, then approve or decline it before forwarding anything to the landlord.",
      ],
      cta: { label: "Review the inquiry", url: appLink(`/app/inquiries/${inquiry.id}`) },
      meta: { inquiryId: inquiry.id, paymentReference },
    });
  }
  queueEmail(db, {
    kind: "inquiry_received",
    to: inquiry.applicant_email,
    workspaceId: inquiry.workspace_id,
    subject: `We received your inquiry for ${property.name}`,
    heading: "Your inquiry has been submitted",
    intro: [
      `Thank you, ${inquiry.applicant_name}. ${workspace.brand_display_name || workspace.name} received your inquiry for ${property.name}.`,
      feeCents > 0 && payment
        ? `One more step: pay the ${formatMoney(feeCents)} inquiry fee through Paystack to complete your application. You can pay from the confirmation page or reopen your inquiry link.`
        : "The legal team will review your details and contact you if anything else is needed.",
    ],
    footnote: "This confirms receipt only. It is not a tenancy offer or approval.",
    meta: { inquiryId: inquiry.id, paymentReference },
  });
  return { inquiryId: inquiry.id, payment };
}

export function markInquiryPaymentPaid(
  db: DatabaseSync,
  input: { reference: string; amountCents: number; source: string },
): { inquiryId: string; changed: boolean } {
  const inquiry = db
    .prepare("SELECT * FROM inquiries WHERE payment_reference = ?")
    .get(input.reference) as unknown as InquiryRow | undefined;
  if (!inquiry) throw new NotFoundError("No inquiry matches this payment reference.");
  if (input.amountCents < inquiry.payment_fee_cents) {
    throw new ConflictError("The payment received does not cover the inquiry fee.");
  }
  if (inquiry.payment_status === "paid") {
    return { inquiryId: inquiry.id, changed: false };
  }
  const now = nowIso();
  transaction(db, () => {
    const changed = db
      .prepare(
        "UPDATE inquiries SET payment_status = 'paid', paid_at = ?, updated_at = ? WHERE id = ? AND payment_status != 'paid'",
      )
      .run(now, now, inquiry.id).changes;
    if (!changed) return;
    appendCaseEvent(db, {
      workspaceId: inquiry.workspace_id,
      entityKind: "inquiry",
      entityId: inquiry.id,
      eventType: "inquiry.payment_paid",
      actorKind: "public",
      actorId: inquiry.id,
      actorLabel: inquiry.applicant_name,
      metadata: {
        reference: input.reference,
        amountCents: input.amountCents,
        source: input.source,
      },
    });
    appendAuditEvent(db, {
      documentId: inquiry.id,
      workspaceId: inquiry.workspace_id,
      eventType: "inquiry.payment_paid",
      actorKind: "public",
      actorId: inquiry.id,
      actorLabel: inquiry.applicant_name,
      metadata: {
        reference: input.reference,
        amountCents: input.amountCents,
        source: input.source,
      },
    });
  });
  return { inquiryId: inquiry.id, changed: true };
}

export async function verifyInquiryPayment(
  db: DatabaseSync,
  input: { rawToken: string; reference: string },
): Promise<{ inquiryId: string; paymentStatus: InquiryPaymentStatus; changed: boolean }> {
  const lookup = getInquiryByTenantToken(db, input.rawToken);
  if (!lookup.ok) throw new ConflictError("This inquiry link is no longer available.");
  const { inquiry } = lookup.context;
  if (inquiry.payment_fee_cents <= 0) {
    return { inquiryId: inquiry.id, paymentStatus: "not_required", changed: false };
  }
  if (inquiry.payment_status === "paid") {
    return { inquiryId: inquiry.id, paymentStatus: "paid", changed: false };
  }
  if (!inquiry.payment_reference || inquiry.payment_reference !== input.reference) {
    throw new ValidationError("This payment reference does not belong to the inquiry.");
  }
  const verification = await verifyPaystackTransaction(inquiry.payment_reference);
  if (verification.status === "failed" || verification.status === "reversed") {
    db.prepare(
      "UPDATE inquiries SET payment_status = 'failed', updated_at = ? WHERE id = ? AND payment_status = 'pending'",
    ).run(nowIso(), inquiry.id);
    return { inquiryId: inquiry.id, paymentStatus: "failed", changed: false };
  }
  if (verification.status !== "success") {
    return { inquiryId: inquiry.id, paymentStatus: "pending", changed: false };
  }
  const result = markInquiryPaymentPaid(db, {
    reference: inquiry.payment_reference,
    amountCents: verification.amount,
    source: "paystack_callback",
  });
  return { inquiryId: inquiry.id, paymentStatus: "paid", changed: result.changed };
}

export function reviewInquiry(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    inquiryId: string;
    decision: "approve" | "decline";
    note?: string | null;
    actor: { id: string; label: string };
  },
): void {
  const detail = getInquiry(db, input.workspaceId, input.inquiryId);
  if (detail.inquiry.status !== "SUBMITTED") {
    throw new ConflictError("Only a submitted inquiry can be approved or declined.");
  }
  if (
    input.decision === "approve" &&
    detail.inquiry.payment_fee_cents > 0 &&
    detail.inquiry.payment_status !== "paid"
  ) {
    throw new ConflictError(
      "The applicant has not paid the inquiry fee yet. Wait for the Paystack payment before approving.",
    );
  }
  const now = nowIso();
  const status = input.decision === "approve" ? "APPROVED" : "DECLINED";
  transaction(db, () => {
    db.prepare(
      "UPDATE inquiries SET status = ?, reviewed_at = ?, lawyer_note = ?, updated_at = ? WHERE id = ?",
    ).run(status, now, isoOrNull(input.note), now, detail.inquiry.id);
    appendCaseEvent(db, {
      workspaceId: input.workspaceId,
      entityKind: "inquiry",
      entityId: detail.inquiry.id,
      eventType: input.decision === "approve" ? "inquiry.approved" : "inquiry.declined",
      actorKind: "sender",
      actorId: input.actor.id,
      actorLabel: input.actor.label,
      metadata: { note: input.note ?? null },
    });
    appendAuditEvent(db, {
      documentId: detail.inquiry.id,
      workspaceId: input.workspaceId,
      eventType: input.decision === "approve" ? "inquiry.review_approved" : "inquiry.review_declined",
      actorKind: "sender",
      actorId: input.actor.id,
      actorLabel: input.actor.label,
      metadata: { note: input.note ?? null },
    });
  });
  queueEmail(db, {
    kind: input.decision === "approve" ? "inquiry_approved" : "inquiry_declined",
    to: detail.inquiry.applicant_email,
    workspaceId: input.workspaceId,
    subject:
      input.decision === "approve"
        ? `Your inquiry for ${detail.property.name} has been approved`
        : `Update on your inquiry for ${detail.property.name}`,
    heading:
      input.decision === "approve"
        ? "Your inquiry passed the first review"
        : "Your inquiry was not progressed",
    intro:
      input.decision === "approve"
        ? [
            `${input.actor.label} reviewed your inquiry for ${detail.property.name} and approved it.`,
            "It will now be sent to the landlord for their decision. We will let you know when they respond.",
          ]
        : [
            `${input.actor.label} reviewed your inquiry for ${detail.property.name}.`,
            "It was not progressed to the landlord at this stage. You may contact the lawyer if you have questions.",
            input.note ? `Note: ${input.note}` : "",
          ].filter(Boolean),
    footnote: "This message is a status update, not a tenancy offer.",
    meta: { inquiryId: detail.inquiry.id },
  });
}

export function forwardToLandlord(
  db: DatabaseSync,
  input: { workspaceId: string; inquiryId: string; actor: { id: string; label: string } },
): { link: string; expiresAt: string } {
  const detail = getInquiry(db, input.workspaceId, input.inquiryId);
  if (detail.inquiry.status !== "APPROVED") {
    throw new ConflictError("Approve the inquiry before forwarding it to the landlord.");
  }
  const token = newToken(32);
  const expiresAt = addDaysIso(LANDLORD_TOKEN_DAYS);
  const now = nowIso();
  transaction(db, () => {
    db.prepare(
      "UPDATE inquiries SET status = 'LANDLORD_REVIEW', landlord_token_hash = ?, landlord_token_expires_at = ?, forwarded_at = ?, updated_at = ? WHERE id = ?",
    ).run(hashToken(token), expiresAt, now, now, detail.inquiry.id);
    appendCaseEvent(db, {
      workspaceId: input.workspaceId,
      entityKind: "inquiry",
      entityId: detail.inquiry.id,
      eventType: "inquiry.forwarded",
      actorKind: "sender",
      actorId: input.actor.id,
      actorLabel: input.actor.label,
      metadata: { landlordId: detail.landlord.id },
    });
    appendAuditEvent(db, {
      documentId: detail.inquiry.id,
      workspaceId: input.workspaceId,
      eventType: "inquiry.forwarded_to_landlord",
      actorKind: "sender",
      actorId: input.actor.id,
      actorLabel: input.actor.label,
      metadata: { landlordId: detail.landlord.id, email: detail.landlord.email },
    });
  });
  const link = appLink(`/landlord/${token}`);
  queueEmail(db, {
    kind: "landlord_review",
    to: detail.landlord.email,
    workspaceId: input.workspaceId,
    subject: `Tenant inquiry for ${detail.property.name} needs your decision`,
    heading: "A tenant inquiry is ready for your review",
    intro: [
      `${input.actor.label} reviewed ${detail.inquiry.applicant_name}'s inquiry for ${detail.property.name} and forwarded it for your decision.`,
      `You can approve or decline it from the link below. No account is required. The link expires on ${expiryLabel(expiresAt)}.`,
    ],
    cta: { label: "Review the inquiry", url: link },
    footnote: "You can also download a summary from the review page.",
    meta: { inquiryId: detail.inquiry.id, link },
  });
  return { link, expiresAt };
}

export function getInquiryByLandlordToken(db: DatabaseSync, rawToken: string): PublicInquiryLookup {
  if (!rawToken || rawToken.length < 20 || rawToken.length > 400) {
    return { ok: false, reason: "invalid" };
  }
  const inquiry = db
    .prepare("SELECT * FROM inquiries WHERE landlord_token_hash = ?")
    .get(hashToken(rawToken)) as unknown as InquiryRow | undefined;
  if (!inquiry) return { ok: false, reason: "invalid" };
  if (inquiry.landlord_token_expires_at && new Date(inquiry.landlord_token_expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return buildInquiryContext(db, inquiry);
}

export function landlordDecision(
  db: DatabaseSync,
  input: {
    rawToken: string;
    decision: "approve" | "decline";
    comment?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  },
): void {
  const lookup = getInquiryByLandlordToken(db, input.rawToken);
  if (!lookup.ok) throw new ConflictError("This landlord review link is no longer available.");
  const { inquiry, property, landlord } = lookup.context;
  if (inquiry.status !== "LANDLORD_REVIEW") {
    throw new ConflictError("This inquiry has already been decided.");
  }
  const comment = text(input.comment, 1000);
  if (input.decision === "decline" && comment.length < 3) {
    throw new ValidationError("Add a short reason for declining.");
  }
  const now = nowIso();
  const status = input.decision === "approve" ? "LANDLORD_APPROVED" : "LANDLORD_DECLINED";
  transaction(db, () => {
    db.prepare(
      "UPDATE inquiries SET status = ?, landlord_reviewed_at = ?, landlord_comment = ?, updated_at = ? WHERE id = ?",
    ).run(status, now, comment || null, now, inquiry.id);
    appendCaseEvent(db, {
      workspaceId: inquiry.workspace_id,
      entityKind: "inquiry",
      entityId: inquiry.id,
      eventType: input.decision === "approve" ? "inquiry.landlord_approved" : "inquiry.landlord_declined",
      actorKind: "public",
      actorId: landlord.id,
      actorLabel: landlord.name,
      metadata: { comment: comment || null, ip: input.ip ?? null },
    });
    appendAuditEvent(db, {
      documentId: inquiry.id,
      workspaceId: inquiry.workspace_id,
      eventType: input.decision === "approve" ? "inquiry.landlord_approved" : "inquiry.landlord_declined",
      actorKind: "public",
      actorId: landlord.id,
      actorLabel: landlord.name,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: { comment: comment || null },
    });
  });

  const lawyer = db
    .prepare("SELECT full_name, email FROM users WHERE id = ?")
    .get(inquiry.created_by) as { full_name: string; email: string } | undefined;
  if (lawyer) {
    queueEmail(db, {
      kind: "landlord_decision",
      to: lawyer.email,
      workspaceId: inquiry.workspace_id,
      subject:
        input.decision === "approve"
          ? `Landlord approved: ${inquiry.applicant_name}`
          : `Landlord declined: ${inquiry.applicant_name}`,
      heading:
        input.decision === "approve"
          ? "The landlord approved the inquiry"
          : "The landlord declined the inquiry",
      intro: [
        `${landlord.name} ${input.decision === "approve" ? "approved" : "declined"} the inquiry for ${property.name}.`,
        comment ? `Landlord comment: ${comment}` : "",
        input.decision === "approve"
          ? "You can now prepare the tenancy agreement and include the tenant, guarantors and landlord in the signing order."
          : "No agreement should be prepared unless the landlord changes their decision.",
      ].filter(Boolean),
      cta: { label: "Open the inquiry", url: appLink(`/app/inquiries/${inquiry.id}`) },
      meta: { inquiryId: inquiry.id, decision: input.decision },
    });
  }
  queueEmail(db, {
    kind: input.decision === "approve" ? "inquiry_landlord_approved" : "inquiry_landlord_declined",
    to: inquiry.applicant_email,
    workspaceId: inquiry.workspace_id,
    subject:
      input.decision === "approve"
        ? `The landlord approved your inquiry for ${property.name}`
        : `Update on your inquiry for ${property.name}`,
    heading:
      input.decision === "approve"
        ? "The landlord approved your inquiry"
        : "The landlord declined your inquiry",
    intro:
      input.decision === "approve"
        ? [
            `The landlord for ${property.name} approved your inquiry.`,
            "The lawyer will now prepare the tenancy agreement and send you the signing steps.",
          ]
        : [
            `The landlord for ${property.name} declined the inquiry at this stage.`,
            "The lawyer can help you explore other properties.",
          ],
    footnote: "This is not a tenancy agreement or an offer of possession.",
    meta: { inquiryId: inquiry.id },
  });
}

export async function createAgreementFromPrecedent(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    userId: string;
    userLabel: string;
    userEmail: string;
    inquiryId: string;
    precedentId: string;
    startDate: string;
    endDate: string;
  },
): Promise<{ agreementId: string; documentId: string }> {
  const precedent = getPrecedent(input.precedentId);
  if (!precedent) throw new NotFoundError("Precedent not found.");
  const detail = getInquiry(db, input.workspaceId, input.inquiryId);
  if (detail.inquiry.status !== "LANDLORD_APPROVED") {
    throw new ConflictError("The landlord must approve the inquiry before an agreement can be prepared.");
  }
  const existing = db
    .prepare("SELECT id, document_id FROM agreements WHERE inquiry_id = ? LIMIT 1")
    .get(detail.inquiry.id) as { id: string; document_id: string } | undefined;
  if (existing) throw new ConflictError("An agreement has already been prepared for this inquiry.");
  const start = parseDate(input.startDate, "Enter a valid tenancy start date.");
  const end = parseDate(input.endDate, "Enter a valid tenancy end date.");
  if (new Date(end).getTime() <= new Date(start).getTime()) {
    throw new ValidationError("The tenancy end date must be after the start date.");
  }
  const rent = Math.max(
    0,
    Math.min(
      100_000_000,
      Math.round(detail.unit?.rent_amount_cents ?? detail.property.rent_amount_cents ?? 0),
    ),
  );
  if (rent <= 0) {
    throw new ValidationError(
      "Add the monthly rent to the property or unit before preparing the agreement.",
    );
  }
  const jurisdiction = `${detail.property.state}, ${detail.property.city}`;
  const workspace = db
    .prepare(
      "SELECT name, brand_display_name, law_firm_email FROM workspaces WHERE id = ?",
    )
    .get(input.workspaceId) as
    | { name: string; brand_display_name: string | null; law_firm_email: string | null }
    | undefined;
  if (!workspace) throw new NotFoundError("Workspace not found.");
  const lawyerName = text(input.userLabel, 120) || workspace.name;
  const lawyerEmail = text(workspace.law_firm_email, 254) || text(input.userEmail, 254);
  if (lawyerEmail && !isValidEmail(lawyerEmail)) {
    throw new ValidationError("Add a valid law firm email in your workspace settings.");
  }
  if (lawyerEmail && !lawyerName) throw new ValidationError("Enter the lawyer's name.");

  const recipients = [
    { key: "tenant", name: detail.inquiry.applicant_name, email: detail.inquiry.applicant_email, order: 1 },
    ...detail.guarantors.map((guarantor, index) => ({
      key: `guarantor-${index}`,
      name: guarantor.name,
      email: guarantor.email,
      order: 2,
    })),
    { key: "landlord", name: detail.landlord.name, email: detail.landlord.email, order: 3 },
    ...(lawyerEmail ? [{ key: "lawyer", name: lawyerName, email: lawyerEmail, order: 4 }] : []),
  ];
  const emails = new Set<string>();
  for (const recipient of recipients) {
    if (!isValidEmail(recipient.email)) throw new ValidationError(`Enter a valid email for ${recipient.name}.`);
    const key = normalizeEmail(recipient.email);
    if (emails.has(key)) {
      throw new ValidationError("Each signer needs a different email address.");
    }
    emails.add(key);
  }

  const title = detail.unit
    ? `${precedent.title} — ${detail.property.name}, Unit ${detail.unit.unit_number}`
    : `${precedent.title} — ${detail.property.name}`;
  const brandLogo = readBrandLogo(db, input.workspaceId);
  const pdf = await buildAgreementPdf({
    precedent,
    workspaceName: workspace.brand_display_name || workspace.name,
    title,
    landlordName: detail.landlord.name,
    landlordEmail: detail.landlord.email,
    tenantName: detail.inquiry.applicant_name,
    tenantEmail: detail.inquiry.applicant_email,
    guarantors: detail.guarantors.map((guarantor) => ({
      name: guarantor.name,
      email: guarantor.email,
      relationship: guarantor.relationship,
    })),
    propertyLabel: detail.unit
      ? `${detail.property.name} — Unit ${detail.unit.unit_number} (${detail.property.reference})`
      : `${detail.property.name} (${detail.property.reference})`,
    propertyAddress: [detail.property.address_line1, detail.property.city, detail.property.state, detail.property.postal_code]
      .filter(Boolean)
      .join(", "),
    rentLabel: `${formatMoney(rent)} per month`,
    startDate: formatLongDate(start),
    endDate: formatLongDate(end),
    jurisdiction,
    preparedBy: input.userLabel,
    lawyer: lawyerEmail
      ? { name: lawyerName, email: lawyerEmail, firmName: workspace.name }
      : null,
    logo: brandLogo ? { bytes: brandLogo.bytes, mediaType: brandLogo.mediaType } : null,
  });
  const saved = saveBuffer(input.workspaceId, Buffer.from(pdf.bytes), "pdf");
  const documentId = newId("doc");
  const agreementId = newId("agr");
  const now = nowIso();
  const recipientIds = new Map<string, string>();
  transaction(db, () => {
    db.prepare(
      `INSERT INTO documents
        (id, workspace_id, created_by, title, status, signing_mode, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'DRAFT', 'sequential', ?, ?)`,
    ).run(documentId, input.workspaceId, input.userId, title, now, now);
    const fileId = newId("fil");
    db.prepare(
      `INSERT INTO document_files
        (id, document_id, kind, original_filename, mime, bytes, sha256, storage_key, page_count, encrypted, created_at)
       VALUES (?, ?, 'original', ?, 'application/pdf', ?, ?, ?, ?, 0, ?)`,
    ).run(
      fileId,
      documentId,
      `${precedent.id}.pdf`,
      saved.bytes,
      saved.sha256,
      saved.storageKey,
      pdf.pageCount,
      now,
    );
    db.prepare("UPDATE documents SET original_file_id = ? WHERE id = ?").run(fileId, documentId);

    for (const recipient of recipients) {
      const recipientId = newId("rcp");
      recipientIds.set(recipient.key, recipientId);
      db.prepare(
        `INSERT INTO recipients
          (id, document_id, name, email, email_normalized, role, signing_order, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'signer', ?, 'PENDING', ?, ?)`,
      ).run(
        recipientId,
        documentId,
        recipient.name,
        recipient.email,
        normalizeEmail(recipient.email),
        recipient.order,
        now,
        now,
      );
    }
    for (const placement of pdf.placements) {
      const recipientId = recipientIds.get(placement.recipientKey);
      if (!recipientId) continue;
      db.prepare(
        `INSERT INTO fields
          (id, document_id, page_index, type, label, recipient_id, required, x, y, width, height, rotation,
           font_size, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 0, NULL, ?, ?)`,
      ).run(
        newId("fld"),
        documentId,
        placement.pageIndex,
        placement.type,
        placement.type === "signature" ? "Signature" : "Date",
        recipientId,
        placement.x,
        placement.y,
        placement.width,
        placement.height,
        now,
        now,
      );
    }
    db.prepare(
      `INSERT INTO agreements
        (id, workspace_id, inquiry_id, property_id, unit_id, landlord_id, lawyer_name, lawyer_email,
         document_id, precedent_id, title, start_date, end_date, rent_amount_cents, created_by,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      agreementId,
      input.workspaceId,
      detail.inquiry.id,
      detail.property.id,
      detail.unit?.id ?? null,
      detail.landlord.id,
      lawyerName || null,
      lawyerEmail || null,
      documentId,
      precedent.id,
      title,
      start,
      end,
      rent,
      input.userId,
      now,
      now,
    );
    db.prepare(
      `INSERT INTO payments
        (id, workspace_id, agreement_id, property_id, recorded_by, description, amount_cents,
         due_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DUE', ?, ?)`,
    ).run(
      newId("pay"),
      input.workspaceId,
      agreementId,
      detail.property.id,
      input.userId,
      detail.unit
        ? `${detail.property.name} · Unit ${detail.unit.unit_number} — first rent instalment`
        : `${detail.property.name} — first rent instalment`,
      rent,
      start.slice(0, 10),
      now,
      now,
    );
    db.prepare("UPDATE inquiries SET status = 'AGREEMENT_CREATED', updated_at = ? WHERE id = ?").run(
      now,
      detail.inquiry.id,
    );
    db.prepare("UPDATE guarantors SET status = 'INCLUDED', updated_at = ? WHERE inquiry_id = ?").run(
      now,
      detail.inquiry.id,
    );
    appendCaseEvent(db, {
      workspaceId: input.workspaceId,
      entityKind: "inquiry",
      entityId: detail.inquiry.id,
      eventType: "agreement.created",
      actorKind: "sender",
      actorId: input.userId,
      actorLabel: input.userLabel,
      metadata: { agreementId, documentId, precedentId: precedent.id },
    });
    appendCaseEvent(db, {
      workspaceId: input.workspaceId,
      entityKind: "agreement",
      entityId: agreementId,
      eventType: "agreement.created",
      actorKind: "sender",
      actorId: input.userId,
      actorLabel: input.userLabel,
      metadata: { inquiryId: detail.inquiry.id, documentId, precedentId: precedent.id },
    });
    appendAuditEvent(db, {
      documentId,
      workspaceId: input.workspaceId,
      eventType: "document.created_from_precedent",
      actorKind: "sender",
      actorId: input.userId,
      actorLabel: input.userLabel,
      metadata: {
        precedentId: precedent.id,
        inquiryId: detail.inquiry.id,
        propertyId: detail.property.id,
        signingMode: "sequential",
      },
    });
  });
  return { agreementId, documentId };
}

function parseDate(value: string, message: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new ValidationError(message);
  return date.toISOString();
}

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export { formatMoney } from "./money";

export function listAgreements(db: DatabaseSync, workspaceId: string): AgreementListRow[] {
  const rows = db
    .prepare(
      `SELECT a.*, d.status AS document_status,
        p.name AS property_name, p.reference AS property_reference, l.name AS landlord_name,
        u.unit_number AS unit_number, i.applicant_name AS tenant_name,
        (SELECT COUNT(*) FROM recipients r WHERE r.document_id = a.document_id) AS signer_count,
        (SELECT COUNT(*) FROM recipients r WHERE r.document_id = a.document_id AND r.status = 'SIGNED') AS signed_count
       FROM agreements a
       JOIN documents d ON d.id = a.document_id
       LEFT JOIN properties p ON p.id = a.property_id
       LEFT JOIN property_units u ON u.id = a.unit_id
       LEFT JOIN landlords l ON l.id = a.landlord_id
       LEFT JOIN inquiries i ON i.id = a.inquiry_id
       WHERE a.workspace_id = ?
       ORDER BY a.created_at DESC`,
    )
    .all(workspaceId);
  return plainRows<AgreementListRow>(rows);
}

export function listPayments(db: DatabaseSync, workspaceId: string): PaymentListRow[] {
  const rows = db
    .prepare(
      `SELECT pay.*, p.name AS property_name, i.applicant_name AS tenant_name
       FROM payments pay
       LEFT JOIN properties p ON p.id = pay.property_id
       LEFT JOIN agreements a ON a.id = pay.agreement_id
       LEFT JOIN inquiries i ON i.id = a.inquiry_id
       WHERE pay.workspace_id = ?
       ORDER BY CASE pay.status WHEN 'DUE' THEN 0 ELSE 1 END, pay.due_date ASC`,
    )
    .all(workspaceId);
  return plainRows<PaymentListRow>(rows);
}

export function createPayment(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    userId: string;
    userLabel: string;
    agreementId?: string | null;
    description: string;
    amountCents: number;
    dueDate: string;
  },
): PaymentRow {
  const description = text(input.description, 160);
  if (description.length < 2) throw new ValidationError("Add a payment description.");
  const amount = Math.max(0, Math.min(100_000_000, Math.round(input.amountCents)));
  if (amount <= 0) throw new ValidationError("Enter a payment amount.");
  const due = parseDate(input.dueDate, "Enter a valid due date.");
  let propertyId: string | null = null;
  if (input.agreementId) {
    const agreement = db
      .prepare("SELECT property_id FROM agreements WHERE id = ? AND workspace_id = ?")
      .get(input.agreementId, input.workspaceId) as { property_id: string | null } | undefined;
    if (!agreement) throw new NotFoundError("Agreement not found.");
    propertyId = agreement.property_id;
  }
  const id = newId("pay");
  const now = nowIso();
  db.prepare(
    `INSERT INTO payments
      (id, workspace_id, agreement_id, property_id, recorded_by, description, amount_cents, due_date, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DUE', ?, ?)`,
  ).run(
    id,
    input.workspaceId,
    input.agreementId ?? null,
    propertyId,
    input.userId,
    description,
    amount,
    due,
    now,
    now,
  );
  appendCaseEvent(db, {
    workspaceId: input.workspaceId,
    entityKind: "payment",
    entityId: id,
    eventType: "payment.recorded",
    actorKind: "sender",
    actorId: input.userId,
    actorLabel: input.userLabel,
    metadata: { amount, dueDate: due, agreementId: input.agreementId ?? null },
  });
  return db.prepare("SELECT * FROM payments WHERE id = ?").get(id) as unknown as PaymentRow;
}

export function updatePayment(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    paymentId: string;
    description: string;
    amountCents: number;
    dueDate: string;
    actor: { id: string; label: string };
  },
): PaymentRow {
  const payment = db
    .prepare("SELECT * FROM payments WHERE id = ? AND workspace_id = ?")
    .get(input.paymentId, input.workspaceId) as unknown as PaymentRow | undefined;
  if (!payment) throw new NotFoundError("Payment not found.");
  const description = text(input.description, 160);
  if (description.length < 2) throw new ValidationError("Add a payment description.");
  const amount = Math.max(0, Math.min(100_000_000, Math.round(input.amountCents)));
  if (amount <= 0) throw new ValidationError("Enter a payment amount.");
  const due = parseDate(input.dueDate, "Enter a valid due date.");
  const now = nowIso();
  db.prepare(
    "UPDATE payments SET description = ?, amount_cents = ?, due_date = ?, updated_at = ? WHERE id = ?",
  ).run(description, amount, due, now, payment.id);
  appendCaseEvent(db, {
    workspaceId: input.workspaceId,
    entityKind: "payment",
    entityId: payment.id,
    eventType: "payment.updated",
    actorKind: "sender",
    actorId: input.actor.id,
    actorLabel: input.actor.label,
    metadata: { description, amount, dueDate: due },
  });
  return { ...(db.prepare("SELECT * FROM payments WHERE id = ?").get(payment.id) as object) } as PaymentRow;
}

export function deletePayment(
  db: DatabaseSync,
  input: { workspaceId: string; paymentId: string; actor: { id: string; label: string } },
): void {
  const payment = db
    .prepare("SELECT * FROM payments WHERE id = ? AND workspace_id = ?")
    .get(input.paymentId, input.workspaceId) as unknown as PaymentRow | undefined;
  if (!payment) throw new NotFoundError("Payment not found.");
  db.prepare("DELETE FROM payments WHERE id = ? AND workspace_id = ?").run(
    payment.id,
    input.workspaceId,
  );
  appendCaseEvent(db, {
    workspaceId: input.workspaceId,
    entityKind: "payment",
    entityId: payment.id,
    eventType: "payment.deleted",
    actorKind: "sender",
    actorId: input.actor.id,
    actorLabel: input.actor.label,
    metadata: { description: payment.description, amount: payment.amount_cents },
  });
}

export function markPaymentPaid(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    paymentId: string;
    method: string;
    note?: string | null;
    actor: { id: string; label: string };
  },
): void {
  const payment = db
    .prepare("SELECT * FROM payments WHERE id = ? AND workspace_id = ?")
    .get(input.paymentId, input.workspaceId) as unknown as PaymentRow | undefined;
  if (!payment) throw new NotFoundError("Payment not found.");
  if (payment.status === "PAID") throw new ConflictError("This payment is already marked as paid.");
  const method = text(input.method, 60);
  if (!method) throw new ValidationError("Choose how the payment was made.");
  const now = nowIso();
  db.prepare(
    "UPDATE payments SET status = 'PAID', paid_at = ?, method = ?, note = ?, updated_at = ? WHERE id = ?",
  ).run(now, method, isoOrNull(input.note), now, payment.id);
  appendCaseEvent(db, {
    workspaceId: input.workspaceId,
    entityKind: "payment",
    entityId: payment.id,
    eventType: "payment.marked_paid",
    actorKind: "sender",
    actorId: input.actor.id,
    actorLabel: input.actor.label,
    metadata: { method, amount: payment.amount_cents, note: input.note ?? null },
  });
}

export function sendRenewalReminder(
  db: DatabaseSync,
  input: {
    workspaceId: string;
    agreementId: string;
    actor: { id: string; label: string };
  },
): void {
  const row = db
    .prepare(
      `SELECT a.*, d.status AS document_status, p.name AS property_name, p.reference AS property_reference,
        i.applicant_name AS tenant_name, i.applicant_email AS tenant_email, l.name AS landlord_name, l.email AS landlord_email
       FROM agreements a
       JOIN documents d ON d.id = a.document_id
       LEFT JOIN properties p ON p.id = a.property_id
       LEFT JOIN inquiries i ON i.id = a.inquiry_id
       LEFT JOIN landlords l ON l.id = a.landlord_id
       WHERE a.id = ? AND a.workspace_id = ?`,
    )
    .get(input.agreementId, input.workspaceId) as
    | (AgreementListRow & {
        tenant_email: string | null;
        landlord_email: string | null;
        property_reference: string | null;
      })
    | undefined;
  if (!row) throw new NotFoundError("Agreement not found.");
  if (row.document_status === "VOIDED") throw new ConflictError("This agreement has been voided.");
  const end = formatLongDate(row.end_date);
  if (row.tenant_email) {
    queueEmail(db, {
      kind: "renewal_reminder",
      to: row.tenant_email,
      workspaceId: input.workspaceId,
      subject: `Tenancy renewal reminder: ${row.property_name}`,
      heading: "Your tenancy end date is approaching",
      intro: [
        `The tenancy for ${row.property_name} is due to end on ${end}.`,
        `${input.actor.label} has asked us to remind you to discuss renewal or handover arrangements.`,
      ],
      footnote: "This is a reminder, not a notice to terminate or a renewal offer.",
      meta: { agreementId: row.id },
    });
  }
  if (row.landlord_email) {
    queueEmail(db, {
      kind: "renewal_reminder",
      to: row.landlord_email,
      workspaceId: input.workspaceId,
      subject: `Tenancy renewal reminder: ${row.property_name}`,
      heading: "A tenancy is approaching its end date",
      intro: [
        `The tenancy for ${row.property_name} (${row.property_reference || "property"}) ends on ${end}.`,
        `${input.actor.label} sent this reminder so renewal or handover can be arranged.`,
      ],
      cta: { label: "View the agreement", url: appLink(`/app/documents/${row.document_id}`) },
      meta: { agreementId: row.id },
    });
  }
  appendCaseEvent(db, {
    workspaceId: input.workspaceId,
    entityKind: "agreement",
    entityId: row.id,
    eventType: "agreement.renewal_reminder_sent",
    actorKind: "sender",
    actorId: input.actor.id,
    actorLabel: input.actor.label,
    metadata: { endDate: row.end_date },
  });
}

export function getTenancyStats(db: DatabaseSync, workspaceId: string): TenancyStats {
  const row = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM landlords WHERE workspace_id = ?) AS landlords,
        (SELECT COUNT(*) FROM properties WHERE workspace_id = ? AND status != 'archived') AS properties,
        (SELECT COUNT(*) FROM inquiries WHERE workspace_id = ? AND status = 'SUBMITTED') AS submitted,
        (SELECT COUNT(*) FROM inquiries WHERE workspace_id = ? AND status = 'LANDLORD_REVIEW') AS awaiting_landlord,
        (SELECT COUNT(*) FROM inquiries WHERE workspace_id = ? AND status IN ('APPROVED','LANDLORD_APPROVED')) AS approved,
        (SELECT COUNT(*) FROM agreements WHERE workspace_id = ?) AS agreements,
        (SELECT COUNT(*) FROM payments WHERE workspace_id = ? AND status = 'DUE') AS due_payments,
        (SELECT COUNT(*) FROM agreements WHERE workspace_id = ? AND end_date >= ? AND end_date <= ?) AS renewals_soon`,
    )
    .get(
      workspaceId,
      workspaceId,
      workspaceId,
      workspaceId,
      workspaceId,
      workspaceId,
      workspaceId,
      workspaceId,
      nowIso(),
      addDaysIso(60),
    ) as {
    landlords: number;
    properties: number;
    submitted: number;
    awaiting_landlord: number;
    approved: number;
    agreements: number;
    due_payments: number;
    renewals_soon: number;
  };
  return {
    landlords: Number(row.landlords),
    properties: Number(row.properties),
    submitted: Number(row.submitted),
    awaitingLandlord: Number(row.awaiting_landlord),
    approved: Number(row.approved),
    agreements: Number(row.agreements),
    duePayments: Number(row.due_payments),
    renewalsSoon: Number(row.renewals_soon),
  };
}

export function getInquirySummaryPdf(
  db: DatabaseSync,
  input: {
    inquiry: InquiryRow;
    property: PropertyRow;
    unit?: PropertyUnitRow | null;
    landlord: LandlordRow;
    guarantors: GuarantorRow[];
    workspaceName: string;
  },
): Promise<Uint8Array> {
  const logo = readBrandLogo(db, input.inquiry.workspace_id);
  const passportFile = listInquiryFiles(db, input.inquiry.id).find(
    (file) => file.kind === "passport_photo",
  );
  return buildInquirySummaryPdf({
    workspaceName: input.workspaceName,
    propertyName: input.property.name,
    propertyReference: input.property.reference,
    unitLabel: input.unit
      ? `Unit ${input.unit.unit_number} · ${input.unit.unit_type}`
      : null,
    propertyAddress: [
      input.property.address_line1,
      input.property.city,
      input.property.state,
      input.property.postal_code,
    ]
      .filter(Boolean)
      .join(", "),
    landlordName: input.landlord.name,
    landlordEmail: input.landlord.email,
    applicantName: input.inquiry.applicant_name,
    applicantEmail: input.inquiry.applicant_email,
    applicantPhone: input.inquiry.applicant_phone,
    currentAddress: input.inquiry.current_address,
    currentCity: input.inquiry.current_city,
    currentState: input.inquiry.current_state,
    reasonForMoving: input.inquiry.reason_for_moving,
    maritalStatus: input.inquiry.marital_status,
    childrenCount: input.inquiry.children_count,
    employmentStatus: input.inquiry.employment_status,
    employer: input.inquiry.employer,
    occupation: input.inquiry.occupation,
    employmentAddress: input.inquiry.employment_address,
    incomeRange: input.inquiry.income_range,
    religionState: input.inquiry.religion_state,
    idType: input.inquiry.id_type,
    idNumber: input.inquiry.id_number,
    occupantsCount: input.inquiry.occupants_count,
    dependentsCount: input.inquiry.dependents_count,
    bedroomsRequired: input.inquiry.bedrooms_required,
    stateOfOrigin: input.inquiry.state_of_origin,
    additionalInfo: input.inquiry.additional_info,
    declarationAccepted: input.inquiry.declaration_accepted === 1,
    signatureName: input.inquiry.signature_name,
    notes: input.inquiry.notes,
    landlordPhone: input.landlord.phone,
    propertyType:
      [input.property.category, input.property.property_type].filter(Boolean).join(" · ") ||
      null,
    monthlyRent: `${formatMoney(input.property.rent_amount_cents)} per month`,
    passportPhoto: passportFile
      ? { bytes: readInquiryFile(passportFile), mediaType: passportFile.mime }
      : null,
    passportFileName: passportFile?.original_filename ?? null,
    guarantors: input.guarantors.map((guarantor) => ({
      name: guarantor.name,
      email: guarantor.email,
      relationship: guarantor.relationship,
    })),
    status: input.inquiry.status,
    submittedAt: input.inquiry.submitted_at ? formatLongDate(input.inquiry.submitted_at) : null,
    generatedAt: formatLongDate(nowIso()),
    logo: logo ? { bytes: logo.bytes, mediaType: logo.mediaType } : null,
  });
}

export function readInquiryFile(file: InquiryFileRow): Buffer {
  return readStoredObject(file.storage_key);
}

export function getInquiryFile(
  db: DatabaseSync,
  workspaceId: string,
  inquiryId: string,
  fileId: string,
): InquiryFileRow | undefined {
  const inquiry = db
    .prepare("SELECT id FROM inquiries WHERE id = ? AND workspace_id = ?")
    .get(inquiryId, workspaceId);
  if (!inquiry) return undefined;
  return db
    .prepare("SELECT * FROM inquiry_files WHERE id = ? AND inquiry_id = ?")
    .get(fileId, inquiryId) as unknown as InquiryFileRow | undefined;
}

export function verifyInquiryTokenHash(rawToken: string, expected: string | null): boolean {
  if (!expected) return false;
  return safeEqual(hashToken(rawToken), expected);
}

export function inquiryDocumentCount(db: DatabaseSync, workspaceId: string): number {
  return Number(
    (db
      .prepare("SELECT COUNT(*) AS count FROM inquiries WHERE workspace_id = ? AND status != 'DECLINED'")
      .get(workspaceId) as { count: number }).count,
  );
}

