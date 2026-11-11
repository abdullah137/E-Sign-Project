import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection } from "@/components/marketing/legal";

export const metadata: Metadata = {
  title: "Refund policy",
  description:
    "How plan requests and refunds work in the current Juripass deployment, where no payments are processed and rent records are manual.",
};

export default function RefundPage() {
  return (
    <LegalPage
      title="Refund policy"
      summary="The current deployment does not process payments. This page explains what that means for plan changes and refunds."
    >
      <LegalSection number="01" title="No payment is collected today">
        <p>
          This Juripass deployment does not connect to a payment processor or checkout. Creating an
          account, choosing a paid plan or clicking a pricing button does not charge a card, create a
          subscription or generate a payment. Rent and deposit records in the Payments area are also
          entered manually and do not move money. Because no money is collected, there is nothing to
          refund for activity in this deployment.
        </p>
      </LegalSection>

      <LegalSection number="02" title="What selecting a paid plan does">
        <p>
          Selecting Starter or Team records a plan request for the workspace. The workspace remains
          on its current plan. Owners and admins can see the request in Billing. A later request
          supersedes an earlier pending one, and moving the workspace to Free cancels any pending
          request.
        </p>
        <p>
          If a charge ever appears that you did not authorise, contact the operator who provided your
          workspace immediately and preserve the payment record. This deployment itself cannot
          initiate or reverse a card transaction.
        </p>
      </LegalSection>

      <LegalSection number="03" title="When checkout is enabled">
        <p>
          Before payments are enabled, the operator must publish completed refund terms that comply
          with applicable consumer law and the payment provider&apos;s rules. At minimum, a future
          policy should explain:
        </p>
        <LegalList
          items={[
            "The billing cycle, renewal date and how cancellation affects the current period.",
            "Whether unused time is refundable, and any statutory cancellation right that applies.",
            "How duplicate, incorrect or unauthorised charges are reviewed and reversed.",
            "How refunds are issued, the original payment method and expected timing.",
          ]}
        />
        <p>
          Until those terms are published and checkout is live, no paid subscription can start
          through this deployment.
        </p>
      </LegalSection>

      <LegalSection number="04" title="Cancellation and access">
        <p>
          If you no longer need a requested paid plan, switch the workspace back to Free in Billing or
          ask the workspace owner to do so. Existing properties, inquiries, agreements, documents,
          audit records and downloads are not removed by changing plans, although plan limits such
          as template count, API access, public links and retention apply going forward.
        </p>
      </LegalSection>

      <LegalSection number="05" title="Questions">
        <p>
          Review{" "}
          <Link href="/legal/terms" className="font-medium text-brand-ink underline underline-offset-2">
            terms of service
          </Link>{" "}
          and the{" "}
          <Link href="/legal/privacy" className="font-medium text-brand-ink underline underline-offset-2">
            privacy policy
          </Link>{" "}
          for the wider agreement. This deployment does not provide a monitored billing inbox; the
          operator must publish a contact channel before enabling payments.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
