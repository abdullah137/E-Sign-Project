"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, FileSignature } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Precedent } from "@/lib/precedents";

export interface ApprovedInquiryOption {
  id: string;
  applicantName: string;
  propertyName: string;
}

export function PrecedentsPanel({
  precedents,
  approvedInquiries,
}: {
  precedents: Precedent[];
  approvedInquiries: ApprovedInquiryOption[];
}) {
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(precedents.map((precedent) => precedent.category)))],
    [precedents],
  );
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  const visible = precedents.filter((precedent) => {
    if (category !== "All" && precedent.category !== category) return false;
    if (!query) return true;
    return `${precedent.title} ${precedent.description}`.toLowerCase().includes(query.toLowerCase());
  });

  const target = approvedInquiries[0];

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-hairline bg-surface p-5">
        <p className="text-[13px] leading-6 text-slate">
          Precedents are starting points. After the landlord approves an inquiry, choose a precedent to generate a
          prefilled agreement, then review the clauses before sending it for signature.
        </p>
        {approvedInquiries.length > 0 ? (
          <p className="mt-2 text-[13px] text-ink-secondary">
            {approvedInquiries.length} inquir{approvedInquiries.length === 1 ? "y" : "ies"} ready for an agreement.
          </p>
        ) : (
          <p className="mt-2 text-[12.5px] text-slate">
            No inquiry is ready for an agreement yet. Approve one and get the landlord&apos;s approval first.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded-pill px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                category === item
                  ? "bg-brand-600 text-white"
                  : "bg-surface-muted text-ink-secondary hover:bg-surface-subtle"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search precedents"
          className="h-9 w-56 rounded border border-hairline-strong bg-surface px-3 text-[13px] text-ink placeholder:text-placeholder"
          aria-label="Search precedents"
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
          title="No precedents match"
          description="Try another category or search term."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((precedent) => (
            <article key={precedent.id} className="rounded-card border border-hairline bg-card p-5">
              <p className="text-[11px] font-semibold uppercase tracking-overline text-slate">
                {precedent.category}
              </p>
              <h2 className="mt-1.5 text-[16px] font-semibold text-ink">{precedent.title}</h2>
              <p className="mt-1.5 text-[12.5px] leading-6 text-slate">{precedent.description}</p>
              <p className="mt-3 text-[12px] text-slate">
                <span className="font-medium text-ink-secondary">Parties:</span> {precedent.parties.join(", ")}
              </p>
              <details className="group mt-3 rounded-lg border border-hairline bg-surface px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[12.5px] font-medium text-ink">
                  Preview {precedent.clauses.length} clauses
                  <ChevronDown className="h-4 w-4 text-slate transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <ol className="mt-3 space-y-3 text-[12px] leading-5 text-slate">
                  {precedent.clauses.map((clause, index) => (
                    <li key={index} className="border-l border-hairline pl-3">
                      <p className="font-medium text-ink-secondary">{clause.heading}</p>
                      <p className="mt-0.5">{clause.body}</p>
                    </li>
                  ))}
                </ol>
              </details>
              <div className="mt-4 flex flex-wrap gap-2">
                {target ? (
                  <Link href={`/app/inquiries/${target.id}`} className={buttonStyles("primary", "sm")}>
                    <FileSignature className="h-4 w-4" aria-hidden="true" />
                    Use for {target.applicantName}
                  </Link>
                ) : (
                  <Link href="/app/inquiries" className={buttonStyles("secondary", "sm")}>
                    <FileSignature className="h-4 w-4" aria-hidden="true" />
                    Choose an approved inquiry
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="rounded-lg border border-hairline bg-surface-subtle px-4 py-3 text-[12px] leading-5 text-slate">
        These precedents are working drafts, not jurisdiction-specific legal advice. The agreement generator adds
        a disclaimer and leaves the final clauses editable so a lawyer can adapt them.
      </p>
    </div>
  );
}
