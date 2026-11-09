import { apiError, apiOk, assertSameOrigin, handleRouteError, parseJsonBody } from "@/lib/api";
import { isAdmin } from "@/lib/auth";
import { requireApiContext } from "@/lib/api-auth";
import { getDb } from "@/lib/db";
import { bankAccountSchema } from "@/lib/validation";
import { updateBankDetails } from "@/lib/workspace-admin";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    if (!isAdmin(ctx.membership.role)) {
      return apiError("Only workspace owners and admins can change payout details.", 403, "forbidden");
    }
    const parsed = await parseJsonBody(request, bankAccountSchema);
    if ("response" in parsed) return parsed.response;
    updateBankDetails(getDb(), ctx.workspace.id, {
      bankName: parsed.data.bankName,
      bankCode: parsed.data.bankCode ?? null,
      accountName: parsed.data.accountName,
      accountNumber: parsed.data.accountNumber,
      accountType: parsed.data.accountType,
    });
    return apiOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
