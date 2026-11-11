import type { InquiryStatus } from "@/lib/tenancy";

export type InquiryTone = "neutral" | "gold" | "success" | "danger" | "muted";

export const INQUIRY_STATUS_META: Record<InquiryStatus, { label: string; tone: InquiryTone; description: string }> = {
  DRAFT: {
    label: "Form sent",
    tone: "neutral",
    description: "The tenant has not completed the inquiry form yet.",
  },
  SUBMITTED: {
    label: "Ready to review",
    tone: "gold",
    description: "Review the details, then approve or decline before the landlord sees it.",
  },
  APPROVED: {
    label: "Approved — forward",
    tone: "gold",
    description: "Approved by the lawyer. Forward it to the landlord for their decision.",
  },
  DECLINED: {
    label: "Declined",
    tone: "danger",
    description: "The lawyer declined this inquiry. The landlord was not involved.",
  },
  LANDLORD_REVIEW: {
    label: "Landlord reviewing",
    tone: "gold",
    description: "The landlord has a private link to review the inquiry and decide.",
  },
  LANDLORD_APPROVED: {
    label: "Landlord approved",
    tone: "success",
    description: "Prepare the agreement and start the signing order.",
  },
  LANDLORD_DECLINED: {
    label: "Landlord declined",
    tone: "danger",
    description: "The landlord declined this inquiry. No agreement should be prepared.",
  },
  AGREEMENT_CREATED: {
    label: "Agreement created",
    tone: "success",
    description: "The agreement is being signed by the tenant, guarantor and landlord in order.",
  },
};

export const INQUIRY_EVENT_LABELS: Record<string, string> = {
  "inquiry.created": "Inquiry created and form sent",
  "inquiry.form_resent": "Inquiry form resent",
  "inquiry.submitted": "Tenant submitted the inquiry",
  "inquiry.approved": "Lawyer approved the inquiry",
  "inquiry.declined": "Lawyer declined the inquiry",
  "inquiry.forwarded": "Forwarded to the landlord",
  "inquiry.landlord_approved": "Landlord approved the inquiry",
  "inquiry.landlord_declined": "Landlord declined the inquiry",
  "inquiry.updated": "Inquiry details updated",
  "inquiry.deleted": "Inquiry deleted",
  "inquiry.payment_paid": "Inquiry fee paid",
  "inquiry.payment_failed": "Inquiry fee payment failed",
  "landlord.created": "Landlord added",
  "landlord.updated": "Landlord updated",
  "landlord.deleted": "Landlord deleted",
  "property.created": "Property added",
  "property.updated": "Property updated",
  "property.deleted": "Property deleted",
  "property.image_updated": "Property image updated",
  "property.image_removed": "Property image removed",
  "unit.created": "Unit added",
  "unit.updated": "Unit updated",
  "unit.deleted": "Unit deleted",
  "agreement.created": "Agreement prepared",
  "payment.recorded": "Payment recorded",
  "payment.updated": "Payment updated",
  "payment.deleted": "Payment deleted",
  "payment.marked_paid": "Payment marked paid",
  "agreement.renewal_reminder_sent": "Renewal reminder sent",
};
