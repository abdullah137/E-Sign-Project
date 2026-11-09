"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiClientError } from "@/lib/client";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { PaymentListRow } from "@/lib/tenancy";

const METHODS = ["Bank transfer", "Cash", "Cheque", "Card", "Mobile money", "Other"];

export interface AgreementOption {
  id: string;
  title: string;
}

export function PaymentsPanel({
  payments,
  agreements,
}: {
  payments: PaymentListRow[];
  agreements: AgreementOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [paying, setPaying] = useState<PaymentListRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [form, setForm] = useState({
    agreementId: "",
    description: "",
    amount: "",
    dueDate: new Date().toISOString().slice(0, 10),
  });
  const [payForm, setPayForm] = useState({ method: METHODS[0], note: "" });
  const [editing, setEditing] = useState<PaymentListRow | null>(null);
  const [editForm, setEditForm] = useState({ description: "", amount: "", dueDate: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const openCreate = () => {
    setError(null);
    setForm({
      agreementId: "",
      description: "",
      amount: "",
      dueDate: new Date().toISOString().slice(0, 10),
    });
    setCreateOpen(true);
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/tenancy/payments", {
        method: "POST",
        body: JSON.stringify({
          agreementId: form.agreementId || null,
          description: form.description,
          amountCents: Math.round(Number(form.amount) * 100),
          dueDate: form.dueDate,
        }),
      });
      toast({ title: "Payment recorded", description: "The payment is marked as due until it is confirmed paid." });
      setCreateOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "The payment could not be recorded.");
    } finally {
      setSaving(false);
    }
  };

  const openPay = (payment: PaymentListRow) => {
    setPayError(null);
    setPayForm({ method: METHODS[0], note: "" });
    setPaying(payment);
  };

  const markPaid = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paying) return;
    setSaving(true);
    setPayError(null);
    try {
      await apiFetch(`/api/tenancy/payments/${paying.id}/pay`, {
        method: "POST",
        body: JSON.stringify({ method: payForm.method, note: payForm.note || null }),
      });
      toast({ title: "Marked as paid", description: "The payment and method are recorded in the activity log." });
      setPaying(null);
      router.refresh();
    } catch (err) {
      setPayError(err instanceof ApiClientError ? err.message : "The payment could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (payment: PaymentListRow) => {
    setEditing(payment);
    setEditError(null);
    setEditForm({
      description: payment.description,
      amount: (payment.amount_cents / 100).toFixed(2),
      dueDate: payment.due_date.slice(0, 10),
    });
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setEditError(null);
    try {
      await apiFetch(`/api/tenancy/payments/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          description: editForm.description,
          amountCents: Math.round(Number(editForm.amount) * 100),
          dueDate: editForm.dueDate,
        }),
      });
      toast({ title: "Payment updated", description: "The payment details have been saved." });
      setEditing(null);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof ApiClientError ? err.message : "The payment could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (payment: PaymentListRow) => {
    if (!window.confirm(`Delete "${payment.description}"? This cannot be undone.`)) return;
    setDeleting(payment.id);
    try {
      await apiFetch(`/api/tenancy/payments/${payment.id}`, { method: "DELETE" });
      toast({ title: "Payment deleted", description: `"${payment.description}" was removed.` });
      router.refresh();
    } catch (err) {
      toast({
        title: "Payment not deleted",
        description: err instanceof ApiClientError ? err.message : "Please try again.",
      });
    } finally {
      setDeleting(null);
    }
  };

  const due = payments.filter((payment) => payment.status !== "PAID");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-slate">
          {due.length} due · {payments.length - due.length} paid
        </p>
        <Button type="button" onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Record payment
        </Button>
      </div>

      <p className="rounded-lg border border-hairline bg-warning-bg px-4 py-3 text-[12px] leading-5 text-gold-text">
        Payments are recorded manually. Juripass does not process card payments yet, and a payment marked paid
        here is an offline record rather than a gateway confirmation.
      </p>

      {payments.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-5 w-5" aria-hidden="true" />}
          title="No payments yet"
          description="When an agreement is prepared, the first month's rent is added as a due payment. You can record other rent or deposit payments here."
          action={
            <Button type="button" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Record a payment
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-hairline bg-card">
          <ul className="divide-y divide-hairline">
            {payments.map((payment) => (
              <li key={payment.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-semibold text-ink">{payment.description}</p>
                    <Badge tone={payment.status === "PAID" ? "success" : "gold"} dot>
                      {payment.status === "PAID" ? "Paid" : "Due"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[12.5px] text-slate">
                    {payment.property_name ?? "No property"}
                    {payment.tenant_name ? ` · ${payment.tenant_name}` : ""} · due {formatDate(payment.due_date)}
                  </p>
                  {payment.status === "PAID" ? (
                    <p className="mt-0.5 text-[12px] text-slate">
                      Paid {payment.paid_at ? formatDateTime(payment.paid_at) : ""}
                      {payment.method ? ` · ${payment.method}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[14px] font-semibold text-ink tabular">{formatMoney(payment.amount_cents)}</span>
                  {payment.status === "PAID" ? (
                    <CheckCircle2 className="h-4 w-4 text-success-text" aria-hidden="true" />
                  ) : (
                    <Button type="button" variant="secondary" size="sm" onClick={() => openPay(payment)}>
                      Mark paid
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(payment)} aria-label={`Edit ${payment.description}`}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={deleting === payment.id}
                    onClick={() => remove(payment)}
                    aria-label={`Delete ${payment.description}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Record a payment"
        description="Use this for rent, deposits or other tenancy charges paid offline."
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="payment-form" loading={saving}>
              Record payment
            </Button>
          </div>
        }
      >
        <form id="payment-form" onSubmit={create} className="space-y-4">
          <FormField label="Agreement" htmlFor="payment-agreement">
            <Select
              id="payment-agreement"
              value={form.agreementId}
              onChange={(event) => setForm((current) => ({ ...current, agreementId: event.target.value }))}
            >
              <option value="">No agreement (other charge)</option>
              {agreements.map((agreement) => (
                <option key={agreement.id} value={agreement.id}>
                  {agreement.title}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Description" htmlFor="payment-description" required>
            <Input
              id="payment-description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="November rent"
              required
              data-autofocus
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Amount" htmlFor="payment-amount" required>
              <Input
                id="payment-amount"
                type="number"
                min={0.01}
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                required
              />
            </FormField>
            <FormField label="Due date" htmlFor="payment-due" required>
              <Input
                id="payment-due"
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                required
              />
            </FormField>
          </div>
          {error ? (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger">
              {error}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={paying !== null}
        onClose={() => setPaying(null)}
        title="Mark payment as paid"
        description={paying ? `${paying.description} · ${formatMoney(paying.amount_cents)}` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPaying(null)}>
              Cancel
            </Button>
            <Button type="submit" form="mark-paid-form" loading={saving}>
              Mark as paid
            </Button>
          </div>
        }
      >
        <form id="mark-paid-form" onSubmit={markPaid} className="space-y-4">
          <FormField label="How was it paid?" htmlFor="payment-method" required>
            <Select
              id="payment-method"
              value={payForm.method}
              onChange={(event) => setPayForm((current) => ({ ...current, method: event.target.value }))}
            >
              {METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Note" htmlFor="payment-note" hint="Optional. Reference number or receipt details.">
            <Textarea
              id="payment-note"
              value={payForm.note}
              onChange={(event) => setPayForm((current) => ({ ...current, note: event.target.value }))}
              maxLength={500}
            />
          </FormField>
          {payError ? (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger">
              {payError}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit payment"
        description={editing?.property_name ? `${editing.property_name} · ${formatMoney(editing.amount_cents)}` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="payment-edit-form" loading={saving}>
              Save changes
            </Button>
          </div>
        }
      >
        <form id="payment-edit-form" onSubmit={saveEdit} className="space-y-4">
          <FormField label="Description" htmlFor="payment-edit-description" required>
            <Input
              id="payment-edit-description"
              value={editForm.description}
              onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
              required
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Amount" htmlFor="payment-edit-amount" required>
              <Input
                id="payment-edit-amount"
                type="number"
                min={0.01}
                step="0.01"
                value={editForm.amount}
                onChange={(event) => setEditForm((current) => ({ ...current, amount: event.target.value }))}
                required
              />
            </FormField>
            <FormField label="Due date" htmlFor="payment-edit-due" required>
              <Input
                id="payment-edit-due"
                type="date"
                value={editForm.dueDate}
                onChange={(event) => setEditForm((current) => ({ ...current, dueDate: event.target.value }))}
                required
              />
            </FormField>
          </div>
          {editError ? (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger">
              {editError}
            </p>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}
