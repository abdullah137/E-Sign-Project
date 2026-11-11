import { formatMoney } from "./money";

export type PlanId = "free" | "starter" | "team";

export interface PlanEntitlements {
  /** null means unlimited. */
  documentsPerMonth: number | null;
  /** null means unlimited. */
  recipientsPerDocument: number | null;
  /** null means unlimited. */
  teamSeats: number | null;
  /** Active templates. null means unlimited. */
  templates: number | null;
  /** 0 means the API does not accept document sends. */
  apiDocumentSendsPerMonth: number;
  /** null means unlimited. */
  aiContractReviews: number | null;
  /** null means documents are retained indefinitely. */
  documentRetentionDays: number | null;
  emailNotifications: boolean;
  documentFinalization: boolean;
  auditLogs: boolean;
  customMessages: boolean;
  openNotifications: boolean;
  smsDelivery: boolean;
  customBranding: boolean;
  bulkSend: boolean;
  publicSigningLinks: boolean;
  sharedVisibility: boolean;
  centralizedBilling: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceMonthly: number;
  currency: "NGN";
  billingInterval: "month";
  blurb: string;
  cta: string;
  popular: boolean;
  entitlements: PlanEntitlements;
  /** Marketing feature list, kept verbatim from the reference pricing table. */
  features: string[];
  /** Features in `features` that are catalogued but not yet implemented. */
  pendingFeatures: string[];
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    currency: "NGN",
    billingInterval: "month",
    blurb: "For solo lawyers and small portfolios",
    cta: "Start for free",
    popular: false,
    entitlements: {
      documentsPerMonth: null,
      recipientsPerDocument: null,
      teamSeats: 1,
      templates: 1,
      apiDocumentSendsPerMonth: 0,
      aiContractReviews: 2,
      documentRetentionDays: 14,
      emailNotifications: true,
      documentFinalization: true,
      auditLogs: true,
      customMessages: false,
      openNotifications: false,
      smsDelivery: false,
      customBranding: false,
      bulkSend: false,
      publicSigningLinks: false,
      sharedVisibility: false,
      centralizedBilling: false,
    },
    features: [
      "Unlimited tenant inquiries",
      "Unlimited properties and landlords",
      "Unlimited documents",
      "Unlimited recipients",
      "No API access",
      "1 template",
      "2 free AI contract reviews",
      "Email notifications",
      "Document finalization",
      "Detailed audit logs",
      "Tamper-evident signing record",
      "14-day document retention",
    ],
    pendingFeatures: ["2 free AI contract reviews"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthly: 15000,
    currency: "NGN",
    billingInterval: "month",
    blurb: "For law practices and rental agencies",
    cta: "Get started",
    popular: true,
    entitlements: {
      documentsPerMonth: null,
      recipientsPerDocument: null,
      teamSeats: 3,
      templates: null,
      apiDocumentSendsPerMonth: 50,
      aiContractReviews: null,
      documentRetentionDays: null,
      emailNotifications: true,
      documentFinalization: true,
      auditLogs: true,
      customMessages: true,
      openNotifications: true,
      smsDelivery: true,
      customBranding: true,
      bulkSend: true,
      publicSigningLinks: true,
      sharedVisibility: true,
      centralizedBilling: true,
    },
    features: [
      "Everything in Free",
      "50 API document sends per month",
      "Unlimited templates",
      "Open notifications",
      "Custom messages",
      "Unlimited retention",
      "SMS delivery",
      "Custom branding",
      "AI contract review",
      "Bulk send",
      "Public signing links",
    ],
    pendingFeatures: [
      "50 API document sends per month",
      "Open notifications",
      "SMS delivery",
      "AI contract review",
      "Bulk send",
    ],
  },
  team: {
    id: "team",
    name: "Team",
    priceMonthly: 60000,
    currency: "NGN",
    billingInterval: "month",
    blurb: "For multi-office teams",
    cta: "Upgrade to Team",
    popular: false,
    entitlements: {
      documentsPerMonth: null,
      recipientsPerDocument: null,
      teamSeats: null,
      templates: null,
      apiDocumentSendsPerMonth: 250,
      aiContractReviews: null,
      documentRetentionDays: null,
      emailNotifications: true,
      documentFinalization: true,
      auditLogs: true,
      customMessages: true,
      openNotifications: true,
      smsDelivery: true,
      customBranding: true,
      bulkSend: true,
      publicSigningLinks: true,
      sharedVisibility: true,
      centralizedBilling: true,
    },
    features: [
      "Everything in Starter",
      "250 API document sends per month",
      "Unlimited team members",
      "Invite teammates",
      "Shared visibility",
      "Centralized billing",
      "Bulk send",
      "Public signing links",
    ],
    pendingFeatures: [
      "250 API document sends per month",
      "Open notifications",
      "SMS delivery",
      "AI contract review",
      "Bulk send",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "starter", "team"];

const LEGACY_PLAN_IDS: Record<string, PlanId> = {
  pro: "starter",
  business: "team",
};

export function normalizePlanId(value: string | null | undefined): PlanId {
  if (!value) return "free";
  const mapped = LEGACY_PLAN_IDS[value] ?? value;
  return mapped in PLANS ? (mapped as PlanId) : "free";
}

export function getPlan(planId: string | null | undefined): PlanDefinition {
  return PLANS[normalizePlanId(planId)];
}

export function isUnlimited(value: number | null): value is null {
  return value === null;
}

export function formatPlanPrice(plan: PlanDefinition): string {
  return formatMoney(planPriceCents(plan));
}

export function planPriceCents(plan: PlanDefinition): number {
  return Math.round(plan.priceMonthly * 100);
}

export function describeLimit(value: number | null, singular: string, plural = `${singular}s`): string {
  return value === null ? `Unlimited ${plural}` : `${value} ${value === 1 ? singular : plural}`;
}

export function hasPlanFeature(
  plan: PlanDefinition,
  feature: keyof PlanEntitlements,
): boolean {
  const value = plan.entitlements[feature];
  return typeof value === "boolean" ? value : value !== 0;
}
