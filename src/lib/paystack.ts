import { createHmac, timingSafeEqual } from "node:crypto";
import { env, paystackEnabled } from "./env";
import { DomainError } from "./errors";

const PAYSTACK_BASE = "https://api.paystack.co";

interface PaystackEnvelope<T> {
  status: boolean;
  message: string;
  data?: T;
}

export interface PaystackAuthorization {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface PaystackVerification {
  status: string;
  reference: string;
  amount: number;
  currency: string;
}

function ensureConfigured(): void {
  if (!paystackEnabled) {
    throw new DomainError(
      "Paystack is not configured for this workspace yet. Add PAYSTACK_SECRET_KEY to enable inquiry payments.",
      "payment_unavailable",
      503,
    );
  }
}

async function readEnvelope<T>(response: Response): Promise<PaystackEnvelope<T>> {
  try {
    return (await response.json()) as PaystackEnvelope<T>;
  } catch {
    return { status: false, message: "Paystack returned an unreadable response." };
  }
}

export async function initializePaystackTransaction(input: {
  email: string;
  amountCents: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackAuthorization> {
  ensureConfigured();
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new DomainError("The inquiry fee is not set correctly.", "validation_error", 422);
  }
  const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.paystack.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountCents,
      currency: env.paystack.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata ?? {},
    }),
  });
  const body = await readEnvelope<{ authorization_url: string; access_code: string; reference: string }>(
    response,
  );
  if (!response.ok || !body.status || !body.data?.authorization_url) {
    throw new DomainError(
      body.message || "Paystack could not start this payment. Try again shortly.",
      "payment_gateway_error",
      502,
    );
  }
  return {
    authorizationUrl: body.data.authorization_url,
    accessCode: body.data.access_code,
    reference: body.data.reference || input.reference,
  };
}

export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerification> {
  ensureConfigured();
  const response = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${env.paystack.secretKey}` },
      cache: "no-store",
    },
  );
  const body = await readEnvelope<PaystackVerification>(response);
  if (!response.ok || !body.status || !body.data) {
    throw new DomainError(
      body.message || "The payment could not be verified with Paystack.",
      "payment_gateway_error",
      502,
    );
  }
  return body.data;
}

export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !paystackEnabled) return false;
  const expected = createHmac("sha512", env.paystack.secretKey).update(rawBody).digest("hex");
  const provided = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (provided.length !== expectedBuffer.length) return false;
  return timingSafeEqual(provided, expectedBuffer);
}
