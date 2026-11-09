export interface Precedent {
  id: string;
  title: string;
  category: string;
  description: string;
  parties: string[];
  clauses: Array<{ heading: string; body: string }>;
}

export const PRECEDENTS: Precedent[] = [
  {
    id: "residential-tenancy",
    title: "Residential tenancy agreement",
    category: "Tenancy",
    description:
      "A standard residential lease linking the landlord, tenant and guarantor with rent, term and property details.",
    parties: ["Landlord", "Tenant", "Guarantor"],
    clauses: [
      {
        heading: "1. Property",
        body: "The landlord lets the property described in this agreement to the tenant for the term stated above. The tenant accepts the property in its current condition, subject to the inventory and any agreed schedule of condition.",
      },
      {
        heading: "2. Rent and deposit",
        body: "The tenant will pay the rent on the due date stated in this agreement without deduction or set-off. A deposit may be held in accordance with applicable tenancy law and returned after the tenancy ends, less any agreed deductions.",
      },
      {
        heading: "3. Use and care",
        body: "The tenant will use the property as a private residence, keep it clean and in good repair, and promptly report damage or defects to the landlord or the lawyer acting for the landlord.",
      },
      {
        heading: "4. Utilities and outgoings",
        body: "Unless stated otherwise, the tenant is responsible for utilities consumed at the property and the landlord is responsible for structural repairs and charges expressly allocated to the landlord.",
      },
      {
        heading: "5. Guarantee",
        body: "Each guarantor guarantees the tenant's payment and performance obligations under this agreement. The guarantee is a continuing obligation and is enforced only in accordance with applicable law.",
      },
      {
        heading: "6. Ending the tenancy",
        body: "Either party may end the tenancy only by giving the notice required by law or by written agreement. The tenant must return all keys and leave the property in the condition required by this agreement.",
      },
      {
        heading: "7. Governing law",
        body: "This agreement is governed by the laws of the jurisdiction stated in the key terms. Any dispute will first be referred to good-faith negotiation before formal proceedings.",
      },
    ],
  },
  {
    id: "company-lease",
    title: "Commercial lease for a company",
    category: "Tenancy",
    description:
      "A commercial lease for office or retail premises, with company tenant, permitted use and service charge terms.",
    parties: ["Landlord", "Company tenant", "Guarantor"],
    clauses: [
      {
        heading: "1. Demised premises",
        body: "The landlord lets the premises to the company tenant for the term stated above, together with the rights of access and shared facilities described in the schedules.",
      },
      {
        heading: "2. Permitted use",
        body: "The tenant will use the premises only for the permitted use stated in the key terms and will obtain every licence and consent required for that use.",
      },
      {
        heading: "3. Rent review",
        body: "The rent may be reviewed on the review dates stated in this agreement. The reviewed rent will be the higher of the passing rent and the open market rent for comparable premises.",
      },
      {
        heading: "4. Repair and alterations",
        body: "The tenant will keep the interior in repair, replace damaged fixtures and make no structural alteration without the landlord's written consent.",
      },
      {
        heading: "5. Service charge",
        body: "The tenant will pay a fair proportion of the costs of maintaining and insuring the shared parts of the building, calculated on the basis set out in the schedule.",
      },
      {
        heading: "6. Guarantee and indemnity",
        body: "The guarantor guarantees the company tenant's obligations and indemnifies the landlord against loss arising from the tenant's default, subject to applicable law.",
      },
      {
        heading: "7. Termination",
        body: "The landlord may terminate on material breach that remains unremedied after written notice. The tenant may terminate only as expressly permitted in this agreement.",
      },
      {
        heading: "8. Governing law",
        body: "This lease is governed by the laws of the jurisdiction stated in the key terms.",
      },
    ],
  },
  {
    id: "legal-retainer",
    title: "Legal services retainer",
    category: "Legal services",
    description:
      "An engagement letter for ongoing legal services with scope, fees, confidentiality and client instructions.",
    parties: ["Law firm", "Client"],
    clauses: [
      {
        heading: "1. Scope",
        body: "The firm will provide the legal services described in the engagement schedule. Work outside that scope requires a written variation agreed by both parties.",
      },
      {
        heading: "2. Fees and disbursements",
        body: "The client will pay the fees stated in the schedule and reimburse agreed disbursements. Invoices are payable within the period stated in the key terms.",
      },
      {
        heading: "3. Client instructions",
        body: "The firm will act on the client's lawful instructions and will keep the client informed of material developments. The client will provide complete and accurate information.",
      },
      {
        heading: "4. Confidentiality",
        body: "The firm will keep the client's information confidential except where disclosure is required by law, necessary to provide the services, or authorised by the client.",
      },
      {
        heading: "5. Conflicts",
        body: "The firm will check for conflicts before accepting the engagement and will notify the client if a conflict arises during the engagement.",
      },
      {
        heading: "6. Termination",
        body: "Either party may terminate the engagement on reasonable written notice. Fees for work completed and disbursements incurred remain payable.",
      },
    ],
  },
  {
    id: "banking-facility",
    title: "Banking facility agreement",
    category: "Banking",
    description:
      "A secured facility letter covering drawdown, interest, covenants and security, for use as a precedent only.",
    parties: ["Bank", "Borrower", "Guarantor"],
    clauses: [
      {
        heading: "1. Facility",
        body: "The bank makes available the facility described in the key terms on the conditions set out in this agreement. The borrower may draw the facility in one or more tranches.",
      },
      {
        heading: "2. Interest and fees",
        body: "Interest accrues on each drawing at the rate stated in the key terms. The borrower will also pay the arrangement and commitment fees described in the schedule.",
      },
      {
        heading: "3. Security",
        body: "The borrower's obligations are secured by the security documents listed in the schedule. The bank may enforce that security in accordance with its terms and applicable law.",
      },
      {
        heading: "4. Representations",
        body: "The borrower represents that it has the authority to enter into this agreement and that the information provided to the bank is accurate and not misleading.",
      },
      {
        heading: "5. Covenants",
        body: "The borrower will comply with the financial and information covenants in the schedule and will notify the bank of any event of default promptly.",
      },
      {
        heading: "6. Events of default",
        body: "The bank may cancel the facility and demand repayment if an event of default occurs, subject to any remedy period stated in this agreement.",
      },
      {
        heading: "7. Governing law",
        body: "This agreement is governed by the laws stated in the key terms and the courts of that jurisdiction have exclusive jurisdiction.",
      },
    ],
  },
  {
    id: "capital-markets",
    title: "Capital markets engagement",
    category: "Capital markets",
    description:
      "An engagement precedent for advising on a securities offering, including diligence, disclosure and allocation support.",
    parties: ["Issuer", "Adviser", "Guarantor"],
    clauses: [
      {
        heading: "1. Engagement",
        body: "The issuer engages the adviser to provide the services described in the schedule in connection with the proposed offering of securities.",
      },
      {
        heading: "2. Diligence",
        body: "The issuer will provide accurate and complete information for the offering document and will promptly update the adviser if any material information changes.",
      },
      {
        heading: "3. Fees",
        body: "The issuer will pay the advisory and success fees stated in the schedule, together with agreed expenses, on the terms set out in this agreement.",
      },
      {
        heading: "4. Allocation",
        body: "Any allocation of securities remains subject to the issuer's instructions, applicable regulation and the adviser's allocation policy.",
      },
      {
        heading: "5. Confidentiality and announcements",
        body: "Each party will keep confidential information secure and will not issue a public announcement without the other party's prior written consent, except where required by law.",
      },
      {
        heading: "6. Regulatory status",
        body: "The adviser will maintain the registrations and approvals required to perform the services. This precedent does not itself establish regulatory compliance.",
      },
    ],
  },
  {
    id: "music-performance",
    title: "Music performance agreement",
    category: "Creative",
    description:
      "A performance engagement covering appearance, fee, technical riders, recording rights and cancellation.",
    parties: ["Promoter", "Artist", "Guarantor"],
    clauses: [
      {
        heading: "1. Engagement",
        body: "The artist will perform at the event described in the key terms for the fee stated in this agreement, subject to the technical rider agreed by the parties.",
      },
      {
        heading: "2. Production",
        body: "The promoter will provide the stage, sound, lighting and crew specified in the rider. Changes to the rider require written agreement.",
      },
      {
        heading: "3. Recording",
        body: "The promoter may not record, broadcast or stream the performance without the artist's prior written consent, except as required for event security.",
      },
      {
        heading: "4. Cancellation",
        body: "If the event is cancelled for reasons outside the artist's control, the promoter will pay any agreed cancellation fee. The artist will give notice of any inability to perform promptly.",
      },
      {
        heading: "5. Conduct and safety",
        body: "Each party will comply with venue safety rules and applicable law. The promoter will maintain public liability insurance for the event.",
      },
      {
        heading: "6. Governing law",
        body: "This agreement is governed by the laws stated in the key terms.",
      },
    ],
  },
  {
    id: "property-management-authority",
    title: "Property management authority",
    category: "Property",
    description:
      "An authorisation for a lawyer or agent to manage a property, collect rent and instruct contractors on the landlord's behalf.",
    parties: ["Landlord", "Agent"],
    clauses: [
      {
        heading: "1. Appointment",
        body: "The landlord appoints the agent to manage the property for the term stated above and grants the authority described in the schedule.",
      },
      {
        heading: "2. Rent collection",
        body: "The agent will collect rent, issue receipts and keep accurate records of income and expenditure for the property.",
      },
      {
        heading: "3. Maintenance",
        body: "The agent may instruct routine repairs within the approved limit. Expenditure above that limit requires the landlord's prior approval, except in an emergency.",
      },
      {
        heading: "4. Tenancy documents",
        body: "The agent will prepare and manage tenancy documents in accordance with the landlord's instructions and applicable law.",
      },
      {
        heading: "5. Reporting",
        body: "The agent will provide the landlord with a statement of account at the intervals stated in the schedule and make records available for inspection.",
      },
      {
        heading: "6. Liability",
        body: "The agent will act with reasonable care and skill. Nothing in this agreement excludes liability that cannot be excluded by law.",
      },
    ],
  },
  {
    id: "tenant-guarantee",
    title: "Guarantor acknowledgement",
    category: "Tenancy",
    description:
      "A standalone acknowledgement for a guarantor confirming they understand and accept their guarantee obligations.",
    parties: ["Guarantor", "Landlord"],
    clauses: [
      {
        heading: "1. Guarantee",
        body: "The guarantor acknowledges that they have agreed to guarantee the tenant's obligations under the tenancy agreement described above.",
      },
      {
        heading: "2. Understanding",
        body: "The guarantor confirms that they have read the tenancy agreement, understand the extent of the guarantee and have had the opportunity to obtain independent legal advice.",
      },
      {
        heading: "3. Continuing obligation",
        body: "The guarantee continues for the term of the tenancy and any lawful extension, unless released in writing by the landlord.",
      },
      {
        heading: "4. Enforcement",
        body: "The landlord may enforce the guarantee after giving the guarantor written notice and following any process required by applicable law.",
      },
    ],
  },
];

export function getPrecedent(id: string): Precedent | undefined {
  return PRECEDENTS.find((precedent) => precedent.id === id);
}

export function precedentCategoryCounts(): Array<{ category: string; count: number }> {
  const counts = new Map<string, number>();
  for (const precedent of PRECEDENTS) {
    counts.set(precedent.category, (counts.get(precedent.category) ?? 0) + 1);
  }
  return Array.from(counts, ([category, count]) => ({ category, count })).sort((a, b) =>
    a.category.localeCompare(b.category),
  );
}
