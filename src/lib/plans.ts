export interface PlanDefinition {
  id: "free" | "pro" | "business";
  name: string;
  priceMonthly: number;
  documentsPerMonth: number;
  recipientsPerDocument: number;
  teamSeats: number;
  blurb: string;
  features: string[];
}

export const PLANS: Record<string, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    documentsPerMonth: 5,
    recipientsPerDocument: 3,
    teamSeats: 1,
    blurb: "For occasional agreements and independent professionals.",
    features: [
      "5 documents per month",
      "Up to 3 recipients per document",
      "Audit certificate for every completed document",
      "Email invitations and reminders",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 19,
    documentsPerMonth: 100,
    recipientsPerDocument: 10,
    teamSeats: 3,
    blurb: "For busy professionals who send agreements every week.",
    features: [
      "100 documents per month",
      "Up to 10 recipients per document",
      "Templates and public signing links",
      "Up to 3 team members with roles",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    priceMonthly: 49,
    documentsPerMonth: 1000,
    recipientsPerDocument: 25,
    teamSeats: 10,
    blurb: "For teams that need shared workspaces and central oversight.",
    features: [
      "1,000 documents per month",
      "Up to 25 recipients per document",
      "Up to 10 team members",
      "Shared templates and branding",
      "Centralised billing and audit access",
    ],
  },
};

export function getPlan(planId: string | null | undefined): PlanDefinition {
  return PLANS[planId || "free"] ?? PLANS.free;
}

export function monthlyDocumentQuota(plan: PlanDefinition): number {
  return plan.documentsPerMonth;
}

export function formatPlanPrice(cents: number): string {
  if (cents === 0) return "$0";
  return `$${(cents / 100).toFixed(0)}`;
}
