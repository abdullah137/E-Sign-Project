import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection } from "@/components/marketing/legal";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "Terms governing the use of Juripass for tenant inquiries, landlord review and signed tenancy agreements.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      summary="The rules that apply when you create a workspace, collect an inquiry, forward it to a landlord or sign an agreement through Juripass."
    >
      <LegalSection number="01" title="Agreement and scope">
        <p>
          These terms govern use of this Juripass deployment. By creating an account, using a
          workspace, completing an inquiry or signing through a link, you agree to them. If you use
          Juripass on behalf of an organisation, you confirm that you are authorised to accept these
          terms for that organisation.
        </p>
        <p>
          Juripass is workflow and evidence software. It is not a law firm, a notary, an identity
          provider, a credit-check agency or a certification authority, and it does not provide
          legal advice.
        </p>
      </LegalSection>

      <LegalSection number="02" title="Accounts and workspace authority">
        <p>
          You are responsible for the accuracy of your account details, for keeping your password
          confidential and for activity under your account. Workspace owners and admins can invite
          members, change roles and manage billing. Invitations must be sent only to people you are
          entitled to include in the workspace. Tenants, guarantors and landlords use private links
          and do not create accounts.
        </p>
        <LegalList
          items={[
            "Do not share accounts or transfer a session to another person.",
            "Tell us promptly if you believe a credential, inquiry link or signing link has been compromised.",
            "You are responsible for the authority of anyone who sends an inquiry or document from your workspace.",
            "You must have a lawful basis for collecting and sharing the personal information you request from tenants and guarantors.",
          ]}
        />
      </LegalSection>

      <LegalSection number="03" title="Properties, inquiries and documents">
        <p>
          You retain ownership of the properties, inquiries, documents and recipient information you
          add. You grant the operator only the limited rights needed to store, process, display,
          forward and finalize those materials so the service can operate.
        </p>
        <p>You must not use Juripass to:</p>
        <LegalList
          items={[
            "Upload content or collect personal information you do not have the right to share or process.",
            "Impersonate another person, fabricate an applicant, or obtain a signature or approval by deception.",
            "Attempt to access another workspace, bypass access controls or interfere with the service.",
            "Send unlawful, harassing or malicious material, or use the service to facilitate fraud or discrimination.",
          ]}
        />
      </LegalSection>

      <LegalSection number="04" title="Tenant inquiries and landlord decisions">
        <p>
          Inquiry details, including income, employment, household and identity information, are
          supplied by the applicant and are not verified by Juripass. You are responsible for
          deciding what to collect, how to assess it and whether sharing it with a landlord is
          lawful and appropriate.
        </p>
        <p>
          Forwarding an inquiry creates a private link for the landlord. A landlord approval or
          decline is a recorded decision, not a tenancy, a credit decision or a guarantee of
          suitability. You remain responsible for your own checks and for any agreement you prepare.
        </p>
      </LegalSection>

      <LegalSection number="05" title="Electronic signatures and consent">
        <p>
          Each signer is asked to consent to electronic signing before their fields unlock. Signing
          records include the consent version, the signer, the document state and server-recorded
          timestamps. You are responsible for determining whether an electronic signature is
          appropriate for your document and jurisdiction.
        </p>
        <p>
          Precedents supplied in the library are working drafts, not legal advice. Juripass does not
          guarantee that a draft, agreement or signature is enforceable, admissible or compliant
          with a particular statute. Requirements can differ by country, industry, document type and
          signing policy. Obtain qualified legal advice for regulated or high-value transactions.
        </p>
      </LegalSection>

      <LegalSection number="06" title="Payments, plans and requests">
        <p>
          The Free plan is available with the limits shown on the pricing page. Starter and Team are
          catalogued at ₦15,000 and ₦60,000 per month in Nigerian naira (NGN). This deployment does
          not process payments: selecting a paid plan records a request in Billing and does not
          charge a card or activate a subscription.
        </p>
        <p>
          Rent, deposits and other tenancy payments are recorded manually in the workspace. Marking a
          payment paid creates an offline record only; Juripass does not move funds, clear a
          transaction or act as a payment processor.
        </p>
        <p>
          Where a checkout is later connected, activation will require a completed payment, and the
          applicable price, renewal and cancellation terms will be shown before purchase. Features
          marked &ldquo;Soon&rdquo; are not part of the current service.
        </p>
      </LegalSection>

      <LegalSection number="07" title="Availability, changes and support">
        <p>
          The service is provided on an as-available basis. Maintenance, provider outages or security
          work may interrupt access. Features may be added, changed or withdrawn; material changes
          that reduce paid entitlements will be communicated before they take effect.
        </p>
        <p>
          This deployment does not operate a staffed support desk. Guidance is available in the{" "}
          <Link href="/help" className="font-medium text-brand-ink underline underline-offset-2">
            help centre
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection number="08" title="Disclaimers and limitation of liability">
        <p>
          To the extent permitted by applicable law, the service is provided without implied
          warranties of merchantability, fitness for a particular purpose or non-infringement.
          Juripass does not warrant that a signature will be accepted by a third party or that the
          service will be uninterrupted or error-free.
        </p>
        <p>
          To the extent permitted by law, the operator is not liable for indirect, incidental,
          special, consequential or punitive loss, or for lost profits, business or data, arising
          from use of the service. Nothing in these terms excludes liability that cannot lawfully be
          excluded.
        </p>
      </LegalSection>

      <LegalSection number="09" title="Suspension, termination and data">
        <p>
          Access may be suspended or terminated for material breach, unlawful use, security risk or
          non-payment where payment applies. On termination, access to the workspace ends. Data
          handling and retention are described in the{" "}
          <Link href="/legal/privacy" className="font-medium text-brand-ink underline underline-offset-2">
            privacy policy
          </Link>
          . Workspace owners can delete drafts, and the operator can remove other data on request.
        </p>
      </LegalSection>

      <LegalSection number="10" title="Governing law and contact">
        <p>
          These terms do not designate a governing jurisdiction in this deployment. The operator must
          insert the governing law, venue and a monitored contact address before commercial use. If
          any provision is found unenforceable, the remaining provisions continue to apply.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
