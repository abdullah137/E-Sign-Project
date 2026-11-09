import { describe, expect, it } from "vitest";
import { registerUser } from "@/lib/account";
import { ValidationError } from "@/lib/errors";
import { updateBankDetails, validateBankDetails } from "@/lib/workspace-admin";
import { makeDb, seedWorkspace } from "./helpers";

const validAccount = {
  bankName: " Zenith Bank ",
  bankCode: "057",
  accountName: "  Hart & Lane Legal ",
  accountNumber: "2087654321",
  accountType: "Current",
};

describe("payout bank details", () => {
  it("trims and normalizes valid NUBAN details", () => {
    expect(validateBankDetails(validAccount)).toEqual({
      bankName: "Zenith Bank",
      bankCode: "057",
      accountName: "Hart & Lane Legal",
      accountNumber: "2087654321",
      accountType: "Current",
    });
  });

  it("rejects an unknown account type", () => {
    expect(() => validateBankDetails({ ...validAccount, accountType: "Credit" })).toThrow(
      ValidationError,
    );
  });

  it("requires a 10-digit account number", () => {
    expect(() => validateBankDetails({ ...validAccount, accountNumber: "12345" })).toThrow(
      "Enter a 10-digit NUBAN account number.",
    );
  });

  it("stores bank details supplied at registration", () => {
    const db = makeDb();
    const { workspaceId } = registerUser(db, {
      fullName: "Daniel Okafor",
      email: "daniel@example.com",
      password: "Passw0rd!",
      bankName: "Zenith Bank",
      bankCode: "057",
      bankAccountName: "Hart & Lane Legal",
      bankAccountNumber: "2087654321",
      bankAccountType: "Current",
    });
    const row = db
      .prepare(
        `SELECT bank_name, bank_code, bank_account_name, bank_account_number, bank_account_type
         FROM workspaces WHERE id = ?`,
      )
      .get(workspaceId);
    expect(row).toEqual({
      bank_name: "Zenith Bank",
      bank_code: "057",
      bank_account_name: "Hart & Lane Legal",
      bank_account_number: "2087654321",
      bank_account_type: "Current",
    });
  });

  it("leaves the account empty when registration skips it", () => {
    const db = makeDb();
    const { workspaceId } = registerUser(db, {
      fullName: "Daniel Okafor",
      email: "daniel@example.com",
      password: "Passw0rd!",
    });
    const row = db
      .prepare("SELECT bank_name, bank_account_number FROM workspaces WHERE id = ?")
      .get(workspaceId);
    expect(row).toEqual({ bank_name: null, bank_account_number: null });
  });

  it("updates the payout account from settings", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db);
    updateBankDetails(db, workspaceId, validAccount);
    const row = db
      .prepare("SELECT bank_name, bank_account_type FROM workspaces WHERE id = ?")
      .get(workspaceId);
    expect(row).toEqual({ bank_name: "Zenith Bank", bank_account_type: "Current" });
  });
});
