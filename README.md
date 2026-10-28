# SignFlow

SignFlow is a working electronic-signature workspace: upload a PDF, place fields on every page, send private signing links, collect consent and signatures, and produce a completed PDF with a hash-chained audit record.

The interface follows the Atelier Executive design language — warm off-white surfaces, charcoal type, a restrained gold accent, Newsreader headings and Manrope body text.

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
| Owner | `demo@signflow.test` | `SignFlow2026!` |
| Admin | `maya@signflow.test` | `SignFlow2026!` |

The seed creates the **Hart & Co.** workspace on the Pro plan with sample documents, recipients, a completed agreement and an audit trail. Re-run `npm run seed -- --reset` to remove local QA data and rebuild the demo workspace.

### Email in development

Without `SMTP_HOST`, SignFlow does not attempt to send mail. Invitations, reminders, verification codes and completion notices are written to a local outbox at **http://localhost:3000/dev/outbox** (enabled when `NODE_ENV` is not `production`). Set `SHOW_DEV_OUTBOX=false` to hide the route. Configure `SMTP_*` in `.env.local` to deliver real email.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server on port 3000 |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript strict check |
| `npm test` | Vitest unit/integration suite (49 tests) |
| `npm run seed` | Create or refresh the demo workspace |
| `npm run seed -- --reset` | Delete the demo workspace and rebuild it |
| `npm run setup:pdf-worker` | Copy the PDF.js worker into `public/` |

## What works

- **Accounts** — registration, email verification, login, logout, password reset, session expiry, profile and password changes.
- **Workspaces** — onboarding, invitations, owner/admin/member roles, role-aware navigation and server-side permission checks.
- **Documents** — private PDF upload (5 MB / 100 pages), list, search, detail, download, delete drafts, void sent requests, expiry and reminders.
- **Field editor** — multi-page placement, drag, resize, keyboard nudging, recipient assignment, required flags, zoom/rotation-aware normalized geometry and debounced autosave.
- **Signing** — account-free links, electronic-signing consent, typed/drawn/uploaded signatures, initial fields, required-field enforcement, decline, completion and finalization.
- **Evidence** — SHA-256 of the original and completed PDFs, hash-chained audit events, chain verification, audit certificate pages and recipient downloads.
- **Templates** — save a prepared document as a reusable template, instantiate it with new recipients, archive templates.
- **Public links** — single-recipient request links with a one-time email verification code, HMAC-signed tokens, expiry, revocation, usage counts and automatic document creation.
- **Billing & settings** — plan overview, monthly document quota, invoices, team management, branding (display name and accent colour) and API-key lifecycle.
- **API** — read-only `GET /api/v1/documents` authenticated with a workspace API key, cursor-free limit/offset pagination.

Advanced or unavailable items are labelled as such inside the product rather than presented as working buttons. For example, the developer page documents the read-only API and explicitly lists write endpoints, webhooks and OAuth as not yet available.

## Architecture

This build is a single **Next.js 15 App Router** application. The requested target stack (NestJS, MongoDB, Redis, BullMQ, S3, Docker) was not available in this environment, so the following substitutions were made without changing the product behaviour:

| Concern | Implementation here | Production alternative |
| --- | --- | --- |
| API | Next.js route handlers in `src/app/api` | NestJS modules |
| Database | SQLite via Node's built-in `node:sqlite`, WAL mode, foreign keys | MongoDB |
| Jobs | In-process email delivery with retries; PDF finalization in the request/route flow | BullMQ + Redis workers |
| Storage | Private local directory (`data/storage`), opaque keys, streamed through authorised routes | S3 with short-lived signed URLs |
| Sessions | Opaque random tokens, SHA-256 hashes stored in `sessions`, httpOnly cookie | Same, with a shared session store |

The database schema is created and migrated idempotently on first connection (`src/lib/db.ts`). Data and private files live under `data/` by default and can be moved with `SIGNFLOW_DATA_DIR`.

## Security model

- Passwords are hashed with scrypt; session and signing tokens are random and stored only as hashes.
- Signing links are single-purpose, expiring and revoked when a document is voided, declined, deleted or expired.
- Public-link tokens are deterministic HMAC capabilities; only hashes are stored. One-time six-digit email codes are hashed with a link-specific salt and limited to five attempts.
- Every document, template, field, file and audit operation is scoped to the active workspace and checked on the server.
- Uploaded files are never served as unrestricted static assets; downloads pass through permission checks and short-lived signatures where applicable.
- Critical mutations (send, finalize, decline, public-link redemption) are guarded by state checks, transactions and conditional updates to remain idempotent.
- API keys are shown once, stored as hashes and can be revoked.

## Tests

The Vitest suite covers:

- Rotation-aware coordinate conversion, clamping and geometry validation
- Audit hash-chain construction, ordering and tamper detection
- Send validation (recipients, fields, page bounds, plan limits, monthly quota)
- Field completeness rules for signatures, checkboxes, text and email
- Signing token states (valid, missing, voided, declined, revoked, expired) and transitions
- Template instantiation, slot-to-recipient mapping, quota enforcement and archiving
- Public-link tokens, active/revoked/expired/unavailable states, verification-code expiry and one-time redemption

Run `npm test`.

## Legal note

SignFlow produces a detailed evidentiary record: document digests, consent version, timestamps, actor details and a tamper-evident audit chain. Electronic-signature requirements differ by jurisdiction, industry and document type. This application is not legal advice and does not claim universal enforceability; validate requirements with qualified counsel before using it for regulated or high-value agreements.
