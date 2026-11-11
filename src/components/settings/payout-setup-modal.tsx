"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";
import { BANK_ACCOUNT_TYPES, NIGERIAN_BANKS } from "@/lib/banks";

export function PayoutSetupModal({
  initial,
}: {
  initial: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    accountType: string;
  };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(true);
  const [bankName, setBankName] = useState(initial.bankName);
  const [accountName, setAccountName] = useState(initial.accountName);
  const [accountNumber, setAccountNumber] = useState(initial.accountNumber);
  const [accountType, setAccountType] = useState(initial.accountType || "Savings");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (!saving) setOpen(false);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
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
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The payout account could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add your payout account"
      description="Inquiry fees collected through Juripass are settled to this Nigerian bank account. You can change these details later in Settings → Profile."
      size="sm"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={close} disabled={saving}>
            Set up later
          </Button>
          <Button type="submit" form="payout-setup-form" loading={saving}>
            Save payout account
          </Button>
        </>
      }
    >
      <form id="payout-setup-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <div className="flex items-start gap-3 rounded border border-hairline bg-surface-subtle/60 px-4 py-3">
            <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-slate" aria-hidden="true" />
            <p className="text-[12px] leading-5 text-slate">
              Your payout details are stored privately for this workspace and are only visible to owners
              and admins.
            </p>
          </div>
        </div>
        <div>
          <Label htmlFor="setup-payout-bank" required>
            Bank name
          </Label>
          <Select
            id="setup-payout-bank"
            value={bankName}
            onChange={(event) => {
              setBankName(event.target.value);
              setError(null);
            }}
          >
            <option value="">Select your bank</option>
            {NIGERIAN_BANKS.map((bank) => (
              <option key={bank.code} value={bank.name}>
                {bank.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="setup-payout-type" required>
            Bank type
          </Label>
          <Select
            id="setup-payout-type"
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
          <Label htmlFor="setup-payout-number" required>
            Account number
          </Label>
          <Input
            id="setup-payout-number"
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
          <Label htmlFor="setup-payout-name" required>
            Account name
          </Label>
          <Input
            id="setup-payout-name"
            maxLength={120}
            placeholder="As it appears on the bank statement"
            value={accountName}
            onChange={(event) => {
              setAccountName(event.target.value);
              setError(null);
            }}
          />
        </div>
        <div className="sm:col-span-2">
          <FieldError>{error}</FieldError>
        </div>
      </form>
    </Modal>
  );
}
