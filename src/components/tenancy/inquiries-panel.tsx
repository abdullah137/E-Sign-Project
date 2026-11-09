"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardList, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiClientError } from "@/lib/client";
import { formatDate } from "@/lib/format";
import { INQUIRY_STATUS_META } from "@/lib/tenancy-status";
import type { InquiryListRow, InquiryStatus } from "@/lib/tenancy";

const FILTERS: Array<{ id: "all" | "action" | "waiting" | "decided"; label: string }> = [
  { id: "all", label: "All" },
  { id: "action", label: "Needs your review" },
  { id: "waiting", label: "Waiting on others" },
  { id: "decided", label: "Decided" },
];

function matchesFilter(status: InquiryStatus, filter: (typeof FILTERS)[number]["id"]): boolean {
  if (filter === "all") return true;
  if (filter === "action") return status === "SUBMITTED" || status === "APPROVED" || status === "LANDLORD_APPROVED";
  if (filter === "waiting") return status === "DRAFT" || status === "LANDLORD_REVIEW";
  return status === "DECLINED" || status === "LANDLORD_DECLINED" || status === "AGREEMENT_CREATED";
}

export function InquiriesPanel({
  inquiries,
  initialPropertyId,
}: {
  inquiries: InquiryListRow[];
  initialPropertyId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const [propertyId, setPropertyId] = useState(initialPropertyId ?? "");
  const [deleting, setDeleting] = useState<string | null>(null);

  const remove = async (inquiry: InquiryListRow) => {
    if (!window.confirm(`Delete the inquiry from ${inquiry.applicant_name}? This cannot be undone.`)) return;
    setDeleting(inquiry.id);
    try {
      await apiFetch(`/api/tenancy/inquiries/${inquiry.id}`, { method: "DELETE" });
      toast({ title: "Inquiry deleted", description: `${inquiry.applicant_name}'s inquiry was removed.` });
      router.refresh();
    } catch (err) {
      toast({
        title: "Inquiry not deleted",
        description: err instanceof ApiClientError ? err.message : "Please try again.",
      });
    } finally {
      setDeleting(null);
    }
  };

  const properties = useMemo(() => {
    const map = new Map<string, string>();
    for (const inquiry of inquiries) map.set(inquiry.property_id, inquiry.property_name);
    return Array.from(map.entries());
  }, [inquiries]);

  const visible = inquiries.filter((inquiry) => {
    if (propertyId && inquiry.property_id !== propertyId) return false;
    if (!matchesFilter(inquiry.status, filter)) return false;
    if (!query) return true;
    const haystack =
      `${inquiry.applicant_name} ${inquiry.applicant_email} ${inquiry.property_name} ${inquiry.property_reference} ${inquiry.unit_number ?? ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-pill px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                filter === item.id
                  ? "bg-brand-600 text-white"
                  : "bg-surface-muted text-ink-secondary hover:bg-surface-subtle"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" aria-hidden="true" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search applicant or property"
              className="h-9 w-56 pl-9 text-[13px]"
              aria-label="Search inquiries"
            />
          </div>
          <select
            value={propertyId}
            onChange={(event) => setPropertyId(event.target.value)}
            className="h-9 rounded border border-hairline-strong bg-surface px-3 text-[13px] text-ink"
            aria-label="Filter by property"
          >
            <option value="">All properties</option>
            {properties.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <Link href="/app/inquiries/new" className={buttonStyles("primary", "sm")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New inquiry
          </Link>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
          title={inquiries.length === 0 ? "No inquiries yet" : "No inquiries match this filter"}
          description={
            inquiries.length === 0
              ? "Send a tenant inquiry from a property. The tenant completes a private form, then you review it before the landlord sees it."
              : "Try a different status, property or search term."
          }
          action={
            inquiries.length === 0 ? (
              <Link href="/app/inquiries/new" className={buttonStyles("primary", "md")}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New inquiry
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-hairline bg-card">
          <div className="hidden grid-cols-[1.5fr_1.3fr_1fr_0.9fr_0.7fr_auto] gap-4 border-b border-hairline bg-surface-subtle px-5 py-3 text-[11px] font-semibold uppercase tracking-overline text-slate lg:grid">
            <span>Applicant</span>
            <span>Property</span>
            <span>Status</span>
            <span>Landlord</span>
            <span>Submitted</span>
            <span className="sr-only">Open</span>
          </div>
          <ul className="divide-y divide-hairline">
            {visible.map((inquiry) => {
              const meta = INQUIRY_STATUS_META[inquiry.status];
              return (
                <li key={inquiry.id} className="flex items-center">
                  <Link
                    href={`/app/inquiries/${inquiry.id}`}
                    className="grid min-w-0 flex-1 gap-2 px-5 py-4 transition-colors hover:bg-surface-subtle lg:grid-cols-[1.5fr_1.3fr_1fr_0.9fr_0.7fr_auto] lg:items-center lg:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{inquiry.applicant_name}</p>
                      <p className="truncate text-[12px] text-slate">{inquiry.applicant_email}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-ink-secondary">{inquiry.property_name}</p>
                      <p className="text-[11.5px] text-slate">
                        {inquiry.property_reference}
                        {inquiry.unit_number ? ` · Unit ${inquiry.unit_number}` : " · Whole property"}
                      </p>
                    </div>
                    <div>
                      <Badge tone={meta.tone} dot>
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="truncate text-[12.5px] text-slate">{inquiry.landlord_name}</p>
                    <p className="text-[12px] text-slate">
                      {inquiry.submitted_at ? formatDate(inquiry.submitted_at) : "Awaiting form"}
                    </p>
                    <ArrowRight className="hidden h-4 w-4 text-slate lg:block" aria-hidden="true" />
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mr-2 shrink-0"
                    loading={deleting === inquiry.id}
                    onClick={() => remove(inquiry)}
                    aria-label={`Delete inquiry from ${inquiry.applicant_name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
