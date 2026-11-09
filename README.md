# Juripass

Juripass is a working tenancy workspace for lawyers and rental agencies. Add a property, send a prospective tenant a private inquiry form, review it yourself, forward an approved application to the landlord for a decision, then prepare and sign the agreement with **Juripass Sign Flow** — tenant, guarantor and landlord in sequence.

Every surface — marketing, authentication, the signed-in workspace, inquiry and landlord pages, signing links and email — uses the same calm blue system: Inter type, slate ink, soft blue-grey surfaces, a single blue accent, subtle 8–16px radii and restrained shadows in light and dark mode.

## Requirements

- Node.js **24 or newer** (the data layer uses the built-in `node:sqlite` module)
- npm 10+

## Getting started

```bash
npm install
cp .env.example .env.local   # optional; sensible defaults are built in
npm run seed
npm run dev
```

Open http://localhost:3000.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Owner | `demo@juripass.test` | `Juripass2026!` |
| Admin | `maya@juripass.test` | `Juripass2026!` |

The seed creates the **Hart & Lane** workspace on the Starter plan with two landlords, three properties, six inquiries in different states, a signed agreement in progress, payment records and tenancy documents. Re-run `npm run seed -- --reset` to remove local QA data and rebuild the demo workspace. The command prints the private tenant, landlord and signing links it created.

### Email in development

Without `SMTP_HOST`, Juripass does not attempt to send mail. Inquiry invitations, landlord links, signing invitations, reminders, verification codes and completion notices are written to a local outbox at **http://localhost:3000/dev/outbox** (enabled when `NODE_ENV` is not `production`). Set `SHOW_DEV_OUTBOX=false` to hide the route.

To deliver real email, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `SMTP_FROM` in `.env` or `.env.local`. For Gmail, create an App Password, set `SMTP_HOST=smtp.gmail.com`, and use the same address in `SMTP_FROM`. Port 465 uses implicit SSL; port 587 uses STARTTLS, though some networks block 587. The outbox still records each message's delivery status, including failures.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server on port 3000 |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript strict check |
| `npm test` | Vitest unit/integration suite |
| `npm run seed` | Create or refresh the demo workspace |
| `npm run seed -- --reset` | Delete the demo workspace and rebuild it |
| `npm run setup:pdf-worker` | Copy the PDF.js worker into `public/` |

## What works

### Tenancy workflow

- **Landlords and properties** — one landlord can own several properties, each with type, address, rooms, rent, status and inquiry history. Landlords and properties are workspace-scoped.
- **Tenant inquiries** — send a private form for contact details, current address, reason for moving, household, employment, estimated income range, optional religion/state, notes, up to two guarantor contacts and an optional ID document. Applicants confirm a typed signature and acknowledge that false information may lead to a declined application.
- **Lawyer review** — only a submitted inquiry can be approved or declined. Declining records a note and emails the applicant. Approval unlocks forwarding; it does not create a tenancy.
- **Landlord decisions** — forwarding sends the landlord a private, expiring link with a summary PDF. The landlord approves or declines and can leave a comment, without creating an account. Declining requires a reason.
- **Agreements** — after landlord approval, choose a precedent and tenancy dates. Juripass generates a prefilled working draft with signature and date fields for tenant, guarantors and landlord, then opens it in the field editor.
- **Signing order** — agreement documents use sequential signing: tenant first, then guarantor(s), then landlord. Later signers cannot open the document early, and finalization waits for every required signature.
- **Payments and renewals** — record rent, deposits and other amounts manually, mark them paid with a method and note, and send renewal reminders to tenant and landlord. No payment gateway is connected.
- **Precedents** — residential tenancy, company lease, guarantor, property-management authority, legal retainer, banking facility, capital markets and music performance starting points. Every precedent is a working draft, not legal advice.

### Platform

- **Accounts** — registration, email verification, login, logout, password reset, session expiry, profile and password changes.
- **Workspaces** — onboarding, invitations, owner/admin/member roles, role-aware navigation and server-side permission checks.
- **Documents** — private PDF upload (5 MB / 100 pages by default), list, search, detail, download, delete drafts, void sent requests, expiry and reminders. Downloads and file streaming enforce the plan's retention window.
- **Field editor** — multi-page placement, drag, resize, keyboard nudging, recipient assignment, required flags, zoom/rotation-aware normalized geometry and debounced autosave.
- **Signing** — account-free links, electronic-signing consent, typed/drawn/uploaded signatures, initial fields, required-field enforcement, decline, completion and finalization.
- **Evidence** — SHA-256 of the original and completed PDFs, hash-chained audit events, chain verification, audit certificate pages and recipient downloads.
- **Timeline** — one canonical per-document event stream with a monotonic sequence number, actor, recipient, correlation ID, server UTC time, processing/delivery state and deterministic ordering; inquiry and landlord decisions are recorded in a parallel case-event log.
- **Templates** — save a prepared document as a reusable template, instantiate it with new recipients and archive templates. Free allows one active template; paid plans are unlimited.
- **Public links** — single-recipient request links with a one-time email verification code, HMAC-signed tokens, expiry, revocation, usage counts and automatic document creation.
- **Billing & settings** — centralized plan catalogue, plan-change requests, demo invoices, team management, branding (display name and accent colour) and API-key lifecycle. No payment provider is connected: paid plans are recorded as requests and never activated or charged by clicking a pricing button.
- **API** — read-only `GET /api/v1/documents` authenticated with a workspace API key (`jp_live_…`), limit/offset pagination with clamped bounds. Prepared agreements appear as documents.
- **Marketing site** — tenancy-positioned landing page, Help, API documentation, Resources, privacy, terms and refund pages.

Advanced or unavailable items are labelled as such inside the product rather than presented as working buttons. Examples: AI contract review, SMS delivery, bulk send, API document sends, invoicing and payment processing are catalogued but not implemented; the developer page lists write endpoints, webhooks and OAuth as not yet available.

## Plans and entitlements

`src/lib/plans.ts` is the single catalogue used by the landing page, billing screen, registration and server checks.

| Plan | Price | Seats | Templates | Retention | API sends / month |
| --- | --- | --- | --- | --- | --- |
| Free | ₦0 | 1 | 1 active | 14 days | None |
| Starter | ₦15,000 | 3 | Unlimited | Unlimited | 50 (not implemented) |
| Team | ₦60,000 | Unlimited | Unlimited | Unlimited | 250 (not implemented) |

Prices are catalogued in Nigerian naira (NGN). Inquiries, properties, documents and recipients are unlimited on every plan. Legacy `pro` and `business` values are normalized to Starter and Team. Free template creation and the 14-day retention window are enforced on the server. Features shown with a **Soon** badge are catalogued but not implemented, and no paid plan is activated without a payment provider.

Lawyers can add a Nigerian payout account (bank, account name, 10-digit NUBAN number and Savings/Current type) during registration or later under **Settings → Profile**. Inquiry fees are collected through Paystack in NGN (`PAYSTACK_CURRENCY`); the payout account is stored on the workspace and is editable only by owners and admins.

## Verification and data honesty

- Tenant income, employment, identity and household details are **self-reported** and are not verified automatically. Identity uploads are optional and labelled as unverified.
- A lawyer approval and a landlord approval are recorded decisions, not a tenancy offer, a credit decision or a guarantee of suitability.
- Precedent drafts are starting points. Clause review and jurisdiction-specific adaptation remain the responsibility of the user and their counsel.
- Payments marked paid are offline records. Juripass does not move funds or act as a payment processor.
- Renewal reminders are notices, not termination notices or renewal offers.

## Architecture

This build is a single **Next.js 15 App Router** application. The requested target stack (NestJS, MongoDB, Redis, BullMQ, S3, Docker) was not available in this environment, so the following substitutions were made without changing the product behaviour:

| Concern | Implementation here | Production alternative |
| --- | --- | --- |
| API | Next.js route handlers in `src/app/api` | NestJS modules |
| Database | SQLite via Node's built-in `node:sqlite`, WAL mode, foreign keys | MongoDB |
| Jobs | In-process email delivery with retries; PDF finalization in the request/route flow | BullMQ + Redis workers |
| Storage | Private local directory (`data/storage`), opaque keys, streamed through authorised routes | S3 with short-lived signed URLs |
| Sessions | Opaque random tokens, SHA-256 hashes stored in `sessions`, httpOnly cookie | Same, with a shared session store |

The database schema is created and migrated idempotently on first connection (`src/lib/db.ts`). Data and private files live under `data/` by default and can be moved with `SIGNFLOW_DATA_DIR` (the variable name is retained for compatibility).

## Security model

- Passwords are hashed with scrypt; session, inquiry, landlord and signing tokens are random and stored only as hashes.
- Inquiry and landlord links are single-purpose, expiring tokens. Signing links are revoked when a document is voided, declined, deleted or expired.
- Public-link tokens are deterministic HMAC capabilities; only hashes are stored. One-time six-digit email codes are hashed with a link-specific salt and limited to five attempts.
- Every property, landlord, inquiry, agreement, document, template, field, file and audit operation is scoped to the active workspace and checked on the server.
- Identity documents and other uploaded files are never served as unrestricted static assets; downloads pass through permission checks and short-lived signatures where applicable.
- Critical mutations (send, finalize, decline, public-link redemption, inquiry review, landlord decisions) are guarded by state checks, transactions and conditional updates to remain idempotent.
- API keys are shown once, stored as hashes and can be revoked.
- Public inquiry and landlord routes add IP and token-based rate limits and bounded upload sizes.

## Tests

The Vitest suite covers:

- Rotation-aware coordinate conversion, clamping and geometry validation
- Audit hash-chain construction, ordering and tamper detection
- Chronological sequence assignment, occurred/processed/delivered timestamps and legacy hash versions
- Send validation (recipients, fields, page bounds, plan limits, monthly quota)
- Field completeness rules for signatures, checkboxes, text and email
- Signing token states (valid, missing, voided, declined, revoked, expired) and transitions
- End-to-end two-recipient signing: partial progress, finalization, completed PDF digest and audit ordering
- Template instantiation, slot-to-recipient mapping, Free plan template limit and archiving
- Public-link tokens, active/revoked/expired/unavailable states, verification-code expiry and one-time redemption
- Plan catalogue normalization, entitlement flags and billing-request behaviour

Run `npm test`.

## Legal note

Juripass produces a detailed evidentiary record: document digests, consent version, timestamps, actor details and a tamper-evident audit chain. Precedents are working drafts. Electronic-signature and tenancy requirements differ by jurisdiction, industry and document type. This application is not legal advice and does not claim universal enforceability or compliance; validate requirements with qualified counsel before using it for regulated or high-value agreements.
