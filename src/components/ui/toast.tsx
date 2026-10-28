"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (input: { title: string; description?: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (input: { title: string; description?: string; variant?: ToastVariant }) => {
      const id = Date.now() + Math.random();
      setItems((current) => [
        ...current.slice(-2),
        {
          id,
          title: input.title,
          description: input.description,
          variant: input.variant ?? "info",
        },
      ]);
      window.setTimeout(() => dismiss(id), input.variant === "error" ? 8000 : 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-2"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-md border bg-surface px-4 py-3.5 shadow-float",
              item.variant === "success" && "border-[rgba(40,93,57,0.18)]",
              item.variant === "error" && "border-[rgba(186,26,26,0.2)]",
              item.variant === "info" && "border-hairline",
            )}
            role="status"
          >
            {item.variant === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-success-text" aria-hidden="true" />
            ) : item.variant === "error" ? (
              <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-danger" aria-hidden="true" />
            ) : (
              <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-gold-text" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold leading-5 text-ink">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 text-[12.5px] leading-5 text-slate">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate hover:bg-surface-subtle hover:text-ink"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
