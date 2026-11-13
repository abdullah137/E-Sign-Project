import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { env } from "./env";

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_used_at TEXT,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, kind);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  plan TEXT NOT NULL DEFAULT 'free',
  brand_display_name TEXT,
  brand_color TEXT,
  brand_logo_asset_id TEXT,
  law_firm_email TEXT,
  law_firm_phone TEXT,
  law_firm_address TEXT,
  bank_name TEXT,
  bank_code TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  bank_account_type TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  invited_by TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(workspace_id, user_id),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_workspace ON memberships(workspace_id);

CREATE TABLE IF NOT EXISTS workspace_invites (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  role TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_ws ON workspace_invites(workspace_id);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  message TEXT,
  original_file_id TEXT,
  finalized_file_id TEXT,
  sent_at TEXT,
  completed_at TEXT,
  expires_at TEXT,
  void_reason TEXT,
  voided_at TEXT,
  signing_mode TEXT NOT NULL DEFAULT 'parallel',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_ws_status ON documents(workspace_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_documents_ws_created ON documents(workspace_id, created_at);

CREATE TABLE IF NOT EXISTS document_files (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  page_count INTEGER NOT NULL,
  encrypted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_document ON document_files(document_id, kind);

CREATE TABLE IF NOT EXISTS recipients (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'signer',
  signing_order INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDING',
  invite_sent_at TEXT,
  opened_at TEXT,
  consent_at TEXT,
  consent_version TEXT,
  signed_at TEXT,
  declined_at TEXT,
  token_hash TEXT UNIQUE,
  token_expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recipients_document ON recipients(document_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipients_doc_email
  ON recipients(document_id, email_normalized) WHERE role = 'signer';

CREATE TABLE IF NOT EXISTS fields (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  type TEXT NOT NULL,
  label TEXT,
  recipient_id TEXT NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  required INTEGER NOT NULL DEFAULT 1,
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  rotation REAL NOT NULL DEFAULT 0,
  font_size REAL,
  options_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fields_document ON fields(document_id);
CREATE INDEX IF NOT EXISTS idx_fields_recipient ON fields(recipient_id);

CREATE TABLE IF NOT EXISTS field_values (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL UNIQUE REFERENCES fields(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL,
  value_text TEXT,
  signature_asset_id TEXT,
  signature_mode TEXT,
  checked INTEGER,
  recorded_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_values_document ON field_values(document_id);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  document_id TEXT,
  kind TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  media_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_kind TEXT NOT NULL,
  actor_id TEXT,
  actor_label TEXT,
  recipient_id TEXT,
  sequence INTEGER,
  at TEXT NOT NULL,
  processed_at TEXT,
  delivery_status TEXT,
  delivered_at TEXT,
  correlation_id TEXT,
  causation_id TEXT,
  hash_version INTEGER NOT NULL DEFAULT 1,
  ip TEXT,
  user_agent TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  previous_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_document ON audit_events(document_id, at);
CREATE INDEX IF NOT EXISTS idx_audit_ws ON audit_events(workspace_id, at);

CREATE TABLE IF NOT EXISTS email_outbox (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  document_id TEXT,
  recipient_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  next_attempt_at TEXT,
  provider_message_id TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_outbox_created ON email_outbox(created_at);

CREATE TABLE IF NOT EXISTS landlords (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  phone TEXT NOT NULL,
  notes TEXT,
  id_type TEXT,
  id_number TEXT,
  law_firm_name TEXT,
  law_firm_address TEXT,
  law_firm_phone TEXT,
  law_firm_email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, email_normalized)
);
CREATE INDEX IF NOT EXISTS idx_landlords_ws ON landlords(workspace_id, name);

CREATE TABLE IF NOT EXISTS landlord_files (
  id TEXT PRIMARY KEY,
  landlord_id TEXT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_landlord_files ON landlord_files(landlord_id, kind);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  landlord_id TEXT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id),
  reference TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Residential',
  property_type TEXT NOT NULL,
  description TEXT,
  unit_count INTEGER NOT NULL DEFAULT 0,
  address_line1 TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT,
  bedrooms INTEGER NOT NULL DEFAULT 1,
  bathrooms INTEGER NOT NULL DEFAULT 1,
  listing_type TEXT NOT NULL DEFAULT 'entire',
  rent_amount_cents INTEGER NOT NULL DEFAULT 0,
  inquiry_fee_cents INTEGER NOT NULL DEFAULT 0,
  image_storage_key TEXT,
  image_mime TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, reference)
);
CREATE INDEX IF NOT EXISTS idx_properties_ws ON properties(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_properties_landlord ON properties(landlord_id);

CREATE TABLE IF NOT EXISTS property_images (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  original_filename TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_property_images ON property_images(property_id, position);
CREATE INDEX IF NOT EXISTS idx_property_images_ws ON property_images(workspace_id);

CREATE TABLE IF NOT EXISTS property_units (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  unit_type TEXT NOT NULL DEFAULT 'Standard',
  bedrooms INTEGER NOT NULL DEFAULT 0,
  bathrooms INTEGER NOT NULL DEFAULT 1,
  occupancy_status TEXT NOT NULL DEFAULT 'available',
  rent_amount_cents INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(property_id, unit_number)
);
CREATE INDEX IF NOT EXISTS idx_units_property ON property_units(property_id, unit_number);
CREATE INDEX IF NOT EXISTS idx_units_ws ON property_units(workspace_id, occupancy_status);

CREATE TABLE IF NOT EXISTS unit_files (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES property_units(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_unit_files ON unit_files(unit_id, kind);

CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id TEXT REFERENCES property_units(id) ON DELETE SET NULL,
  landlord_id TEXT NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id),
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  applicant_email_normalized TEXT NOT NULL,
  applicant_phone TEXT NOT NULL,
  current_address TEXT,
  current_city TEXT,
  current_state TEXT,
  reason_for_moving TEXT,
  marital_status TEXT,
  children_count INTEGER,
  employment_status TEXT,
  employer TEXT,
  occupation TEXT,
  income_range TEXT,
  religion_state TEXT,
  id_type TEXT,
  id_number TEXT,
  employment_address TEXT,
  employment_category TEXT,
  occupants_count INTEGER,
  dependents_count INTEGER,
  bedrooms_required INTEGER,
  state_of_origin TEXT,
  additional_info TEXT,
  declaration_accepted INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  signature_name TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  tenant_token_hash TEXT UNIQUE,
  tenant_token_expires_at TEXT,
  landlord_token_hash TEXT UNIQUE,
  landlord_token_expires_at TEXT,
  submitted_at TEXT,
  reviewed_at TEXT,
  forwarded_at TEXT,
  landlord_reviewed_at TEXT,
  landlord_comment TEXT,
  lawyer_note TEXT,
  payment_status TEXT NOT NULL DEFAULT 'not_required',
  payment_reference TEXT,
  payment_url TEXT,
  inquiry_fee_cents INTEGER,
  payment_fee_cents INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inquiries_ws_status ON inquiries(workspace_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_inquiries_property ON inquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_email ON inquiries(workspace_id, applicant_email_normalized);

CREATE TABLE IF NOT EXISTS inquiry_files (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inquiry_files_inquiry ON inquiry_files(inquiry_id, kind);

CREATE TABLE IF NOT EXISTS guarantors (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  relationship TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_guarantors_inquiry ON guarantors(inquiry_id);

CREATE TABLE IF NOT EXISTS agreements (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  inquiry_id TEXT REFERENCES inquiries(id) ON DELETE SET NULL,
  property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
  unit_id TEXT REFERENCES property_units(id) ON DELETE SET NULL,
  landlord_id TEXT REFERENCES landlords(id) ON DELETE SET NULL,
  lawyer_name TEXT,
  lawyer_email TEXT,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  precedent_id TEXT,
  title TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  rent_amount_cents INTEGER NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agreements_ws ON agreements(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agreements_inquiry ON agreements(inquiry_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agreements_document ON agreements(document_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agreement_id TEXT REFERENCES agreements(id) ON DELETE SET NULL,
  property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
  recorded_by TEXT NOT NULL REFERENCES users(id),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DUE',
  paid_at TEXT,
  method TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_ws_due ON payments(workspace_id, status, due_date);

CREATE TABLE IF NOT EXISTS case_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_kind TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_kind TEXT NOT NULL,
  actor_id TEXT,
  actor_label TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_case_events_entity ON case_events(entity_kind, entity_id, at);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  source_filename TEXT NOT NULL,
  source_storage_key TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  page_count INTEGER NOT NULL,
  field_blueprints_json TEXT NOT NULL,
  recipient_slots_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_templates_ws ON templates(workspace_id, status);

CREATE TABLE IF NOT EXISTS public_links (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  otp_required INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_public_links_ws ON public_links(workspace_id);

CREATE TABLE IF NOT EXISTS public_link_otps (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES public_links(id) ON DELETE CASCADE,
  email_normalized TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  renews_at TEXT,
  provider_ref TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  issued_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plan_requests_ws ON plan_requests(workspace_id, status);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL DEFAULT 'documents:read',
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const globalForDb = globalThis as unknown as {
  __signflowDb?: DatabaseSync;
  __signflowDbPath?: string;
};

const AUDIT_COLUMNS: Array<[string, string]> = [
  ["recipient_id", "TEXT"],
  ["sequence", "INTEGER"],
  ["processed_at", "TEXT"],
  ["delivery_status", "TEXT"],
  ["delivered_at", "TEXT"],
  ["correlation_id", "TEXT"],
  ["causation_id", "TEXT"],
  ["hash_version", "INTEGER NOT NULL DEFAULT 1"],
];

const DOCUMENT_COLUMNS: Array<[string, string]> = [
  ["signing_mode", "TEXT NOT NULL DEFAULT 'parallel'"],
];

const OUTBOX_COLUMNS: Array<[string, string]> = [
  ["attempts", "INTEGER NOT NULL DEFAULT 0"],
  ["last_attempt_at", "TEXT"],
  ["next_attempt_at", "TEXT"],
  ["provider_message_id", "TEXT"],
];

const LANDLORD_COLUMNS: Array<[string, string]> = [
  ["id_type", "TEXT"],
  ["id_number", "TEXT"],
  ["law_firm_name", "TEXT"],
  ["law_firm_address", "TEXT"],
  ["law_firm_phone", "TEXT"],
  ["law_firm_email", "TEXT"],
];

const WORKSPACE_COLUMNS: Array<[string, string]> = [
  ["law_firm_email", "TEXT"],
  ["law_firm_phone", "TEXT"],
  ["law_firm_address", "TEXT"],
  ["bank_name", "TEXT"],
  ["bank_code", "TEXT"],
  ["bank_account_name", "TEXT"],
  ["bank_account_number", "TEXT"],
  ["bank_account_type", "TEXT"],
];

const PROPERTY_COLUMNS: Array<[string, string]> = [
  ["category", "TEXT NOT NULL DEFAULT 'Residential'"],
  ["description", "TEXT"],
  ["unit_count", "INTEGER NOT NULL DEFAULT 0"],
  ["inquiry_fee_cents", "INTEGER NOT NULL DEFAULT 0"],
  ["image_storage_key", "TEXT"],
  ["image_mime", "TEXT"],
  ["bathrooms", "INTEGER NOT NULL DEFAULT 1"],
  ["listing_type", "TEXT NOT NULL DEFAULT 'entire'"],
];

const UNIT_COLUMNS: Array<[string, string]> = [
  ["bathrooms", "INTEGER NOT NULL DEFAULT 1"],
];

const INQUIRY_COLUMNS: Array<[string, string]> = [
  ["unit_id", "TEXT"],
  ["id_type", "TEXT"],
  ["id_number", "TEXT"],
  ["employment_address", "TEXT"],
  ["employment_category", "TEXT"],
  ["occupants_count", "INTEGER"],
  ["dependents_count", "INTEGER"],
  ["bedrooms_required", "INTEGER"],
  ["state_of_origin", "TEXT"],
  ["additional_info", "TEXT"],
  ["declaration_accepted", "INTEGER NOT NULL DEFAULT 0"],
  ["payment_status", "TEXT NOT NULL DEFAULT 'not_required'"],
  ["payment_reference", "TEXT"],
  ["payment_url", "TEXT"],
  ["inquiry_fee_cents", "INTEGER"],
  ["payment_fee_cents", "INTEGER NOT NULL DEFAULT 0"],
  ["paid_at", "TEXT"],
];

const AGREEMENT_COLUMNS: Array<[string, string]> = [
  ["unit_id", "TEXT"],
  ["lawyer_name", "TEXT"],
  ["lawyer_email", "TEXT"],
];

function tableColumns(db: DatabaseSync, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

function ensureColumns(
  db: DatabaseSync,
  table: string,
  columns: Array<[string, string]>,
): void {
  const existing = tableColumns(db, table);
  for (const [name, definition] of columns) {
    if (!existing.has(name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    }
  }
}

/**
 * Applies idempotent upgrades to databases created before the current schema.
 * Existing audit hashes are preserved: sequence and delivery columns are
 * ordering/processing metadata and are not part of the original hash payload.
 */
export function migrateSchema(db: DatabaseSync): void {
  ensureColumns(db, "workspaces", WORKSPACE_COLUMNS);
  ensureColumns(db, "audit_events", AUDIT_COLUMNS);
  ensureColumns(db, "documents", DOCUMENT_COLUMNS);
  ensureColumns(db, "email_outbox", OUTBOX_COLUMNS);
  ensureColumns(db, "landlords", LANDLORD_COLUMNS);
  ensureColumns(db, "properties", PROPERTY_COLUMNS);
  ensureColumns(db, "property_units", UNIT_COLUMNS);
  ensureColumns(db, "inquiries", INQUIRY_COLUMNS);
  ensureColumns(db, "agreements", AGREEMENT_COLUMNS);

  db.exec(`
    UPDATE audit_events
       SET sequence = (
         SELECT COUNT(*) FROM audit_events AS earlier
          WHERE earlier.document_id = audit_events.document_id
            AND earlier.rowid <= audit_events.rowid
       )
     WHERE sequence IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_document_sequence
      ON audit_events(document_id, sequence) WHERE sequence IS NOT NULL;

    UPDATE workspaces SET plan = 'starter' WHERE plan = 'pro';
    UPDATE workspaces SET plan = 'team' WHERE plan = 'business';
    UPDATE subscriptions SET plan = 'starter' WHERE plan = 'pro';
    UPDATE subscriptions SET plan = 'team' WHERE plan = 'business';
    UPDATE invoices SET plan = 'starter' WHERE plan = 'pro';
    UPDATE invoices SET plan = 'team' WHERE plan = 'business';

    INSERT INTO property_images
      (id, workspace_id, property_id, storage_key, mime, original_filename, position, created_at)
    SELECT 'pimg_' || lower(hex(randomblob(8))), p.workspace_id, p.id, p.image_storage_key,
           COALESCE(p.image_mime, 'image/jpeg'), 'Property image', 0, p.created_at
      FROM properties p
     WHERE p.image_storage_key IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM property_images pi WHERE pi.property_id = p.id);

    UPDATE properties SET image_storage_key = NULL, image_mime = NULL
     WHERE image_storage_key IS NOT NULL;
  `);
}

export function initSchema(db: DatabaseSync): void {
  db.exec(SCHEMA);
  migrateSchema(db);
}

export function createDatabase(filePath: string): DatabaseSync {
  if (filePath !== ":memory:") {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new DatabaseSync(filePath);
  initSchema(db);
  return db;
}

export function getDb(): DatabaseSync {
  const dbPath = path.join(env.dataDir, "signflow.db");
  if (!globalForDb.__signflowDb || globalForDb.__signflowDbPath !== dbPath) {
    globalForDb.__signflowDb = createDatabase(dbPath);
    globalForDb.__signflowDbPath = dbPath;
  }
  return globalForDb.__signflowDb;
}

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore rollback failure, preserve the original error
    }
    throw error;
  }
}

export function toBool(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
