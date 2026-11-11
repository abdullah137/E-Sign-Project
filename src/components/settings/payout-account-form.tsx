"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import { BANK_ACCOUNT_TYPES, NIGERIAN_BANKS } from "@/lib/banks";

export function PayoutAccountForm({
  initial,
  canEdit,
}: {
  initial: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    accountType: string;
  };
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [bankName, setBankName] = useState(initial.bankName);
  const [accountName, setAccountName] = useState(initial.accountName);
  const [accountNumber, setAccountNumber] = useState(initial.accountNumber);
  const [accountType, setAccountType] = useState(initial.accountType || "Savings");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const knownBank = NIGERIAN_BANKS.some((bank) => bank.name === bankName);
  const masked = accountNumber.length === 10 ? `••••••${accountNumber.slice(-4)}` : "Not set";
  const configured = Boolean(initial.bankName && initial.accountNumber);

  const save = async () => {
    setError(null);
    if (!bankName) {
      setError("Select the bank that holds the account.");
      return;
    }
    if (accountName.trim().length < 2) {
      setError("Enter the account name.");
      return;
    }
    if (!/^\d{10}$/.test(accountNumber)) {
      setError("Enter a 10-digit NUBAN account number.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/workspace/banking", {
        method: "PATCH",
        body: JSON.stringify({
          bankName,
          bankCode: NIGERIAN_BANKS.find((bank) => bank.name === bankName)?.code ?? null,
          accountName: accountName.trim(),
          accountNumber,
          accountType,
        }),
      });
      toast({ title: "Payout account saved", variant: "success" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The payout account could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-subtle text-slate">
          <Landmark className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Payout account</h2>
          <p className="mt-0.5 text-[12px] leading-5 text-slate">
            Inquiry fees collected through Juripass are settled to this Nigerian bank account. Stored
            privately for this workspace.
          </p>
        </div>
      </div>

      {canEdit ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="payout-bank" required>
                Bank name
              </Label>
              <Select
                id="payout-bank"
                value={bankName}
                onChange={(event) => {
                  setBankName(event.target.value);
                  setError(null);
                }}
              >
                <option value="">Select your bank</option>
                {!knownBank && bankName ? <option value={bankName}>{bankName}</option> : null}
                {NIGERIAN_BANKS.map((bank) => (
                  <option key={bank.code} value={bank.name}>
                    {bank.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="payout-type" required>
                Bank type
              </Label>
              <Select
                id="payout-type"
                value={accountType}
                onChange={(event) => {
                  setAccountType(event.target.value);
                  setError(null);
                }}
              >
                {BANK_ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="payout-number" required>
                Account number
              </Label>
              <Input
                id="payout-number"
                inputMode="numeric"
                maxLength={10}
                placeholder="0123456789"
                value={accountNumber}
                onChange={(event) => {
                  setAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 10));
                  setError(null);
                }}
              />
            </div>
            <div>
              <Label htmlFor="payout-name" required>
                Account name
              </Label>
              <Input
                id="payout-name"
                maxLength={120}
                placeholder="As it appears on the bank statement"
                value={accountName}
                onChange={(event) => {
                  setAccountName(event.target.value);
                  setError(null);
                }}
              />
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11.5px] leading-5 text-slate">
              {configured
                ? `Saved account: ${initial.bankName} · ${masked} · ${initial.accountType || "Savings"}`
                : "Add your bank details to complete the payout profile."}
            </p>
            <Button onClick={save} loading={saving} className="sm:ml-auto">
              Save payout account
            </Button>
          </div>
          <FieldError>{error}</FieldError>
        </>
      ) : (
        <div className="mt-6 rounded border border-hairline bg-surface-subtle/50 px-4 py-3">
          <p className="text-[12.5px] text-ink-secondary">
            {configured
              ? `${initial.bankName} · ${masked} · ${initial.accountType || "Savings"}`
              : "No payout account has been added yet."}
          </p>
          <p className="mt-1 text-[11.5px] leading-5 text-slate">
            Only workspace owners and admins can view or change payout details.
          </p>
        </div>
      )}
    </section>
  );
}
