"use client";

import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client";
import { AuthMessage } from "./auth-card";

export function ResendVerification() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const resend = async () => {
    setState("sending");
    setMessage(null);
    try {
      await apiFetch("/api/auth/resend-verification", { method: "POST" });
      setState("sent");
      setMessage("A fresh verification email has been sent.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to resend the email.");
    }
  };

  return (
    <div className="space-y-4">
      {state === "sent" ? (
        <AuthMessage tone="success">
          <span className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {message}
          </span>
        </AuthMessage>
      ) : null}
      {state === "error" && message ? <AuthMessage tone="error">{message}</AuthMessage> : null}
      <Button onClick={resend} loading={state === "sending"} className="w-full">
        <Mail className="h-4 w-4" aria-hidden="true" />
        Resend verification email
      </Button>
    </div>
  );
}
