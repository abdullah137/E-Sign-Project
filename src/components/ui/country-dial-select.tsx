"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { COUNTRY_DIAL_CODES } from "@/lib/country-codes";

export function CountryDialSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selectedIndex = Math.max(
    0,
    COUNTRY_DIAL_CODES.findIndex((country) => country.iso === value),
  );
  const selected = COUNTRY_DIAL_CODES[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const openList = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    const spaceBelow = window.innerHeight - (rect?.bottom ?? 0);
    setPlacement(spaceBelow < 300 && (rect?.top ?? 0) > spaceBelow ? "top" : "bottom");
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const choose = (index: number) => {
    const country = COUNTRY_DIAL_CODES[index];
    if (!country) return;
    onChange(country.iso);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, COUNTRY_DIAL_CODES.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(COUNTRY_DIAL_CODES.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label="Country calling code"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={
          open ? `${listId}-${COUNTRY_DIAL_CODES[activeIndex]?.iso ?? ""}` : undefined
        }
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className="relative flex h-11 w-full items-center gap-2 rounded border border-hairline-strong bg-surface px-3 pr-9 text-left text-[15px] text-ink transition-colors duration-150 hover:border-slate/50 focus:border-brand-500 focus-visible:outline-none"
      >
        {selected ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/flags/${selected.iso.toLowerCase()}.png`}
            alt=""
            className="h-[15px] w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10"
          />
        ) : null}
        <span className="font-medium">{selected?.dial ?? "+1"}</span>
        <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate" aria-hidden="true" />
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Country calling codes"
          tabIndex={-1}
          className={cn(
            "absolute left-0 z-30 max-h-64 w-64 overflow-y-auto rounded border border-hairline bg-surface py-1 shadow-float sm:left-auto sm:right-0",
            placement === "top" ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          {COUNTRY_DIAL_CODES.map((country, index) => {
            const isSelected = country.iso === value;
            return (
              <li
                key={country.iso}
                id={`${listId}-${country.iso}`}
                role="option"
                aria-selected={isSelected}
                data-index={index}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => choose(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13.5px]",
                  index === activeIndex ? "bg-surface-subtle" : "",
                  isSelected ? "font-medium text-ink" : "text-ink-secondary",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/flags/${country.iso.toLowerCase()}.png`}
                  alt=""
                  decoding="async"
                  className="h-[15px] w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10"
                />
                <span className="min-w-0 flex-1 truncate">{country.name}</span>
                <span className="shrink-0 tabular-nums text-slate">{country.dial}</span>
                {isSelected ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-brand-text" aria-hidden="true" />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
