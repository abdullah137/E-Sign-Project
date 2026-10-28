"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, CreditCard, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import { formatDate } from "@/lib/format";
import { PLANS, type PlanDefinition } from "@/lib/plans";

export interface BillingView {
  plan: PlanDefinition;
  subscription: { status: string; renewsAt: string | null };
  invoices: Array<{
    id: string;
    plan: string;
    amountCents: number;
    status: string;
    issuedAt: string;
  }>;
  seatsUsed: number;
  seatsIncluded: number;
  documentsThisMonth: number;
}

export function BillingPanel({ billing, isOwner }: { billing: BillingView; isOwner: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [target, setTarget] = useState<PlanDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = billing.plan;
  const quota = current.documentsPerMonth;
  const quotaPercent = Math.min(100, Math.round((billing.documentsThisMonth / quota) * 100));

  const choose = async () => {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/workspace/billing", {
        method: "POST",
        body: JSON.stringify({ plan: target.id }),
      });
      toast({
        title: `Plan changed to ${target.name}`,
        description:
          target.priceMonthly > 0
            ? "A demo invoice was added to your billing history."
            : "Workspace limits now follow the Free plan.",
        variant: "success",
      });
      setTarget(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The plan could not be changed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-subtle text-slate">
              <CreditCard className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-ink">{current.name} plan</h2>
                <Badge tone={current.priceMonthly > 0 ? "success" : "gold"}>
                  {billing.subscription.status === "active" ? "Active" : billing.subscription.status}
                </Badge>
              </div>
              <p className="mt-0.5 text-[12px] leading-5 text-slate">{current.blurb}</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-serif text-[28px] leading-none text-ink">${current.priceMonthly}</p>
            <p className="mt-1 text-[11px] text-slate">per month</p>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 border-t border-hairline pt-5 sm:grid-cols-3">
          <div>
            <dt className="overline">Documents this month</dt>
            <dd className="mt-1.5 text-[13px] font-medium text-ink">
              {billing.documentsThisMonth} of {quota}
            </dd>
            <div className="mt-2 h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-gold transition-[width] duration-200"
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
          </div>
          <div>
            <dt className="overline">Team seats</dt>
            <dd className="mt-1.5 text-[13px] font-medium text-ink">
              {billing.seatsUsed} of {billing.seatsIncluded} used
            </dd>
            <p className="mt-1 text-[11px] text-slate">
              <Link href="/app/settings/team" className="underline-offset-2 hover:text-ink hover:underline">
                Manage team
              </Link>
            </p>
          </div>
          <div>
            <dt className="overline">Renews</dt>
            <dd className="mt-1.5 text-[13px] font-medium text-ink">
              {current.priceMonthly > 0 ? formatDate(billing.subscription.renewsAt) : "No renewal"}
            </dd>
            <p className="mt-1 text-[11px] text-slate">
              {current.priceMonthly > 0 ? "Billing period renews monthly" : "Free plans do not expire"}
            </p>
          </div>
        </dl>
      </section>

      <section>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Available plans</h2>
            <p className="text-[12px] text-slate">
              Plan changes take effect immediately and preserve all existing documents.
            </p>
          </div>
          {!isOwner ? (
            <p className="text-[11.5px] text-slate">Only the workspace owner can change the plan.</p>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {Object.values(PLANS).map((plan) => {
            const isCurrent = plan.id === current.id;
            const isDowngrade = plan.priceMonthly < current.priceMonthly;
            return (
              <div
                key={plan.id}
                className={
                  isCurrent
                    ? "flex flex-col rounded-card border border-gold/60 bg-surface p-5"
                    : "flex flex-col rounded-card border border-hairline bg-surface p-5"
                }
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-ink">{plan.name}</h3>
                  {isCurrent ? <Badge tone="gold">Current</Badge> : null}
                </div>
                <p className="mt-2 font-serif text-[26px] leading-none text-ink">
                  ${plan.priceMonthly}
                  <span className="ml-1 font-sans text-[11px] font-normal text-slate">/mo</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 border-t border-hairline pt-4">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex gap-2 text-[11.5px] leading-5 text-slate">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-gold-text" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button variant="secondary" className="mt-4 w-full" disabled>
                    Current plan
                  </Button>
                ) : (
                  <Button
                    variant={plan.id === "pro" ? "primary" : "secondary"}
                    className="mt-4 w-full"
                    disabled={!isOwner}
                    onClick={() => {
                      setTarget(plan);
                      setError(null);
                    }}
                  >
                    {isDowngrade ? `Switch to ${plan.name}` : `Upgrade to ${plan.name}`}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] leading-5 text-slate">
          This deployment activates plan changes immediately without charging a payment method.
          Production billing would connect a payment provider and issue downloadable receipts.
        </p>
      </section>

      <section className="card p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-subtle text-slate">
            <ReceiptText className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Billing history</h2>
            <p className="mt-0.5 text-[12px] text-slate">Demo invoices generated by plan changes.</p>
          </div>
        </div>
        {billing.invoices.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline text-[10.5px] font-semibold uppercase tracking-overline text-slate">
                  <th className="pb-2.5 pr-4 font-semibold">Invoice</th>
                  <th className="pb-2.5 pr-4 font-semibold">Issued</th>
                  <th className="pb-2.5 pr-4 font-semibold">Plan</th>
                  <th className="pb-2.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {billing.invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-hairline/70 last:border-0">
                    <td className="py-3 pr-4 font-mono text-[11.5px] text-ink-secondary">
                      {invoice.id.replace("inv_", "INV-").slice(0, 14).toUpperCase()}
                    </td>
                    <td className="py-3 pr-4 text-[12px] text-slate">{formatDate(invoice.issuedAt)}</td>
                    <td className="py-3 pr-4 text-[12px] capitalize text-slate">{invoice.plan}</td>
                    <td className="py-3 text-right">
                      <span className="tabular text-[12px] font-medium text-ink">
                        ${(invoice.amountCents / 100).toFixed(2)}
                      </span>
                      <span className="ml-2 text-[10.5px] uppercase tracking-wide text-success-text">
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded border border-hairline bg-surface-subtle/50 px-4 py-3 text-[12px] text-slate">
            No invoices yet. Invoices appear here when you switch to a paid plan.
          </p>
        )}
      </section>

      <Modal
        open={Boolean(target)}
        onClose={() => (saving ? undefined : setTarget(null))}
        title={`Switch to ${target?.name ?? "this plan"}?`}
        description="Your workspace limits change immediately. Existing documents, templates and audit records are preserved."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={choose} loading={saving}>
              Confirm plan change
            </Button>
          </>
        }
      >
        {target ? (
          <dl className="space-y-2 text-[12.5px]">
            <div className="flex items-center justify-between">
              <dt className="text-slate">Monthly price</dt>
              <dd className="font-medium text-ink">${target.priceMonthly}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate">Documents per month</dt>
              <dd className="text-ink-secondary">{target.documentsPerMonth.toLocaleString("en-US")}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate">Recipients per document</dt>
              <dd className="text-ink-secondary">{target.recipientsPerDocument}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate">Team seats</dt>
              <dd className="text-ink-secondary">{target.teamSeats}</dd>
            </div>
          </dl>
        ) : null}
        {error ? <p className="mt-3 text-[12px] leading-5 text-danger">{error}</p> : null}
      </Modal>
    </div>
  );
}
