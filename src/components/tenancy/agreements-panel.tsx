"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSignature, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiClientError } from "@/lib/client";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { AgreementListRow } from "@/lib/tenancy";

const DOC_STATUS: Record<string, { label: string; tone: "neutral" | "gold" | "success" | "danger" | "muted" }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PENDING: { label: "Awaiting signatures", tone: "gold" },
  FINALIZING: { label: "Finalizing", tone: "gold" },
  COMPLETED: { label: "Signed", tone: "success" },
  VOIDED: { label: "Voided", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "muted" },
  DELETED: { label: "Deleted", tone: "muted" },
};

export function AgreementsPanel({ agreements }: { agreements: AgreementListRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remind = async (agreement: AgreementListRow) => {
    setBusy(agreement.id);
    setError(null);
    try {
      await apiFetch(`/api/tenancy/agreements/${agreement.id}/remind`, { method: "POST" });
      toast({
        title: "Renewal reminder sent",
        description: "The tenant and landlord were emailed. The reminder is recorded in the activity log.",
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "The reminder could not be sent.");
    } finally {
      setBusy(null);
    }
  };

  if (agreements.length === 0) {
    return (
      <EmptyState
        icon={<FileSignature className="h-5 w-5" aria-hidden="true" />}
        title="No agreements yet"
        description="Agreements are prepared from an inquiry once the landlord approves it. The tenant, guarantor and landlord then sign in order."
        action={
          <Link href="/app/inquiries" className={buttonStyles("primary", "md")}>
            Review inquiries
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg px-4 py-3 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-card">
        {agreements.map((agreement) => {
          const status = DOC_STATUS[agreement.document_status] ?? DOC_STATUS.DRAFT;
          return (
            <li key={agreement.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[14px] font-semibold text-ink">{agreement.title}</p>
                  <Badge tone={status.tone} dot>
                    {status.label}
                  </Badge>
                </div>
                <p className="mt-1 text-[12.5px] text-slate">
                  {agreement.property_name ?? "Property removed"}
                  {agreement.property_reference ? ` (${agreement.property_reference})` : ""}
                  {agreement.unit_number ? ` · Unit ${agreement.unit_number}` : ""} ·{" "}
                  {agreement.tenant_name ?? "Tenant"} · {formatMoney(agreement.rent_amount_cents)} / month
                </p>
                <p className="mt-0.5 text-[12px] text-slate">
                  {formatDate(agreement.start_date)} – {formatDate(agreement.end_date)} ·{" "}
                  {agreement.signed_count} of {agreement.signer_count} signatures
                  {agreement.lawyer_name ? ` · Lawyer: ${agreement.lawyer_name}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/app/documents/${agreement.document_id}`} className={buttonStyles("secondary", "sm")}>
                  <FileSignature className="h-4 w-4" aria-hidden="true" />
                  Open agreement
                </Link>
                {agreement.inquiry_id ? (
                  <Link href={`/app/inquiries/${agreement.inquiry_id}`} className={buttonStyles("ghost", "sm")}>
                    Inquiry
                  </Link>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  loading={busy === agreement.id}
                  onClick={() => remind(agreement)}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Renewal reminder
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[12px] leading-5 text-slate">
        Renewal reminders are emailed to the tenant and landlord and recorded in the activity log. They do not
        alter the agreement or extend the term automatically.
      </p>
    </div>
  );
}
