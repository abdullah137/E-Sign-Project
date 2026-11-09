"use client";

import { useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

export interface FaqItem {
  question: string;
  answer: React.ReactNode;
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="grid gap-2.5">
      {items.map((item, index) => {
        const open = openIndex === index;
        const buttonId = `${baseId}-button-${index}`;
        const panelId = `${baseId}-panel-${index}`;
        return (
          <div
            key={item.question}
            className="rounded-xl border border-hairline bg-card px-5 py-4"
          >
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? null : index)}
                className="flex w-full items-center justify-between gap-4 text-left text-[14px] font-semibold text-ink"
              >
                <span>{item.question}</span>
                <span
                  className={cn(
                    "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-surface text-slate transition-colors duration-150",
                    open && "bg-brand-50 text-brand-600",
                  )}
                  aria-hidden="true"
                >
                  {open ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!open}
              className="pt-2.5 text-[13.5px] leading-6 text-slate"
            >
              {item.answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}
