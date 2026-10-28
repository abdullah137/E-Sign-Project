import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

const controlClass =
  "w-full rounded border border-[rgba(18,20,23,0.12)] bg-surface text-[15px] text-ink placeholder:text-placeholder transition-colors duration-160 hover:border-[rgba(18,20,23,0.2)] focus:border-gold-text disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-slate aria-[invalid=true]:border-danger";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlClass, "h-11 px-3.5", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(controlClass, "min-h-[104px] resize-y px-3.5 py-2.5 leading-6", className)}
      {...props}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        controlClass,
        "h-11 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat px-3.5 pr-10",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235E6573' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  );
});

export function Label({
  children,
  htmlFor,
  required,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("mb-1.5 block text-[13px] font-medium text-ink", className)}
    >
      {children}
      {required ? <span className="ml-1 text-gold-text">*</span> : null}
    </label>
  );
}

export function FieldError({ children, id }: { children?: React.ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-[12px] leading-5 text-danger" role="alert">
      {children}
    </p>
  );
}

export function FieldHint({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-[12px] leading-5 text-slate">{children}</p>;
}

export function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      <FieldError id={`${htmlFor}-error`}>{error}</FieldError>
      {!error ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }
>(function Checkbox({ className, label, id, ...props }, ref) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "group flex min-h-[44px] cursor-pointer items-start gap-3 text-[14px] leading-6 text-ink-secondary",
        className,
      )}
    >
      <span className="relative mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          id={id}
          ref={ref}
          type="checkbox"
          className="peer h-4 w-4 cursor-pointer appearance-none rounded-sm border border-[rgba(18,20,23,0.28)] bg-white transition-colors checked:border-ink checked:bg-ink"
          {...props}
        />
        <Check
          className="pointer-events-none absolute h-3 w-3 text-white opacity-0 peer-checked:opacity-100"
          aria-hidden="true"
        />
      </span>
      <span>{label}</span>
    </label>
  );
});
