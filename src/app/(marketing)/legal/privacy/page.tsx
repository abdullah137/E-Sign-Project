import type { Metadata } from "next";
import { LegalList, LegalPage, LegalSection } from "@/components/marketing/legal";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What Juripass stores across tenant inquiries, landlord decisions and signed agreements, why it stores it, how it is isolated and how retention works.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      summary="What this deployment collects, how it is used, who processes it and how long it is kept."
    >
      <LegalSection number="01" title="Scope">
        <p>
          This policy describes the Juripass workspace, tenant inquiry pages, landlord decision
          pages, signing pages and marketing site. It covers account holders, workspace members,
          tenants, guarantors and landlords who review or sign without an account. The operator of
          your deployment is the controller of the workspace data; if you were invited to a
          workspace, its owner decides how your information is used.
        </p>
      </LegalSection>

      <LegalSection number="02" title="What we collect">
        <LegalList
          items={[
            "Account details: name, email address, password hash, email-verification and password-reset timestamps.",
            "Workspace details: law firm name, contact email, phone, address, memberships, roles, invitations and branding settings.",
            "Property and landlord details: landlord name, email and phone, property address, type, status, rooms, rent, inquiry fee and optional property image.",
            "Inquiry details: applicant name, email, phone, current or previous address, reason for moving, marital status, children and dependents counts, employment, estimated income range, optional religion or state, notes and signature name.",
            "Guarantor details: guarantor name, email, stated relationship, acknowledgement and signature.",
            "Landlord decisions: approve or decline status, comment and the time the decision was recorded.",
            "Supporting documents: files the workspace attaches to a property or unit, stored privately and only served through permission-checked routes.",
            "Agreement records: tenancy terms, dates, rent, signature counts and the linked signing document.",
            "Payment records: amounts, due dates, method, note and the time a payment was marked paid. Inquiry fees are processed by Paystack; this deployment does not store card details.",
            "Documents: uploaded PDFs, filenames, titles, page counts, file sizes, field definitions, recipient assignments and signed field values.",
            "Signature assets: typed, drawn or uploaded signatures and initials, scoped to the signer who provided them.",
            "Signing evidence: consent version, opens, timestamps, audit events, IP address and browser user-agent where recorded with a signing action.",
            "Billing records: plan, plan requests and invoices generated for the workspace.",
            "API keys: label, prefix, scopes, last-used time and a SHA-256 hash of the key. The full key is shown once and is not stored.",
          ]}
        />
      </LegalSection>

      <LegalSection number="03" title="How information is used">
        <LegalList
          items={[
            "To create and secure accounts, verify email addresses and recover access.",
            "To collect tenant inquiries and present them to the workspace for review.",
            "To share an approved inquiry with the relevant landlord and record their decision.",
            "To prepare, store, finalize and deliver agreements and other signing requests.",
            "To record consent, signatures and an ordered audit trail for each document.",
            "To send transactional email such as inquiry links, landlord links, invitations, reminders, verification codes and completion notices.",
            "To enforce plan limits, workspace roles and API scopes.",
            "To investigate abuse, security incidents and delivery failures.",
          ]}
        />
        <p>
          No third-party advertising or behavioural analytics scripts are loaded in this deployment.
          Information is not sold.
        </p>
      </LegalSection>

      <LegalSection number="04" title="Documents, inquiries and retention">
        <p>
          Uploaded files, identity documents and completed PDFs are stored in workspace-scoped
          private storage. They are streamed through permission-checked routes rather than exposed
          as public files. Inquiry, landlord and signing links are high-entropy tokens stored as
          hashes and can be revoked by resending, voiding, declining or expiry.
        </p>
        <p>
          Free workspaces have a 14-day retention window measured from document completion or
          creation. In this deployment the window is enforced as an access limit: downloads and
          signing access are blocked after it passes. Automatic deletion is not implemented yet.
          Workspace owners can delete drafts at any time, and the operator can remove other
          workspace data on request.
        </p>
      </LegalSection>

      <LegalSection number="05" title="Sharing and processors">
        <p>
          Information is visible to members of the same workspace according to their role. A tenant
          sees only their own inquiry form, a landlord sees only the inquiry sent to them, and a
          signer sees only the fields assigned to them. Information may also be processed by:
        </p>
        <LegalList
          items={[
            "The hosting provider that runs this deployment and stores its database and files.",
            "The configured SMTP provider, which receives recipient email addresses and message content in order to deliver transactional email.",
            "The operator and its personnel when needed to support the workspace, investigate abuse or comply with law.",
          ]}
        />
        <p>
          Processors should be bound by appropriate confidentiality and data-protection terms. This
          deployment does not configure any advertising or analytics recipients.
        </p>
      </LegalSection>

      <LegalSection number="06" title="Cookies and local storage">
        <p>
          Juripass uses an httpOnly session cookie to keep signed-in users authenticated. Inquiry,
          landlord and signing pages rely on the token in the link rather than a cookie. The
          marketing site does not load advertising cookies or analytics trackers.
        </p>
      </LegalSection>

      <LegalSection number="07" title="Security">
        <p>
          Passwords are hashed with scrypt. Session, inquiry, landlord, signing and API tokens are
          stored as hashes. Every property, landlord, inquiry, agreement, document, template, file,
          audit event and billing operation is checked against the active workspace on the server.
          Property and unit attachments are served only through checked routes, and storage
          credentials are never sent to a browser. Audit events are hash-chained so modifications
          can be detected, and completed documents carry a SHA-256 digest.
        </p>
        <p>
          No system is absolutely secure. Protect your password, use a trusted device and tell the
          workspace owner immediately if a link or credential may have been exposed.
        </p>
      </LegalSection>

      <LegalSection number="08" title="Your choices and rights">
        <p>
          Depending on your jurisdiction, you may have rights to access, correct, delete, restrict or
          receive a copy of personal information, and to object to certain processing. Workspace
          members can update their profile in Settings. Workspace owners can remove members and
          drafts. Requests that affect a document&apos;s audit record may be limited by legal or
          evidentiary obligations.
        </p>
        <p>
          This deployment does not provide a monitored privacy inbox. Direct requests to the operator
          who provided your workspace; the operator must publish a monitored privacy contact before
          commercial use.
        </p>
      </LegalSection>

      <LegalSection number="09" title="International processing and changes">
        <p>
          The hosting and email providers used by a deployment may process information in countries
          other than yours. The operator is responsible for putting appropriate transfer safeguards
          in place where required.
        </p>
        <p>
          This policy may be updated as the service changes. Material changes will be reflected by
          the date at the top of this page; continued use after an update means the revised policy
          applies.
        </p>
      </LegalSection>

      <LegalSection number="10" title="Children">
        <p>
          Juripass is intended for business use and is not directed to children. Do not create an
          account or send documents on behalf of a child without the authority required by your
          jurisdiction.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
