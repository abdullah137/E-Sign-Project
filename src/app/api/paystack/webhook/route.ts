import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { verifyPaystackSignature } from "@/lib/paystack";
import { markInquiryPaymentPaid } from "@/lib/tenancy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyPaystackSignature(rawBody, request.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let event: {
    event?: string;
    data?: { reference?: string; amount?: number; status?: string };
  };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (
    event.event === "charge.success" &&
    event.data?.reference &&
    typeof event.data.amount === "number"
  ) {
    try {
      markInquiryPaymentPaid(getDb(), {
        reference: event.data.reference,
        amountCents: event.data.amount,
        source: "paystack_webhook",
      });
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
  }

  return NextResponse.json({ ok: true });
}
