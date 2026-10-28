import { cn } from "@/lib/cn";
import type { DocumentStatus, RecipientStatus } from "@/lib/documents";

type Tone = "neutral" | "gold" | "success" | "danger" | "muted";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-muted text-ink-secondary",
  gold: "bg-warning-bg text-warning-text",
  success: "bg-success-bg text-success-text",
  danger: "bg-[#FBEAEA] text-danger",
  muted: "bg-surface-subtle text-slate",
};

const toneDot: Record<Tone, string> = {
  neutral: "bg-slate",
  gold: "bg-gold",
  success: "bg-[#3E7B51]",
  danger: "bg-danger",
  muted: "bg-[#99A0AC]",
};

const documentStatusMap: Record<
  DocumentStatus,
  { label: string; tone: Tone }
> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PENDING: { label: "Pending signature", tone: "gold" },
  FINALIZING: { label: "Finalizing", tone: "gold" },
  COMPLETED: { label: "Completed", tone: "success" },
  VOIDED: { label: "Voided", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "muted" },
  DELETED: { label: "Deleted", tone: "muted" },
};

const recipientStatusMap: Record<RecipientStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "neutral" },
  INVITED: { label: "Invited", tone: "gold" },
  OPENED: { label: "Viewed", tone: "gold" },
  CONSENTED: { label: "Consented", tone: "gold" },
  SIGNED: { label: "Signed", tone: "success" },
  DECLINED: { label: "Declined", tone: "danger" },
  REVOKED: { label: "Revoked", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "muted" },
};

export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold leading-4",
        toneClasses[tone],
        className,
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", toneDot[tone])} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: DocumentStatus;
  className?: string;
}) {
  const meta = documentStatusMap[status] ?? documentStatusMap.DRAFT;
  return (
    <Badge tone={meta.tone} dot className={className}>
      {meta.label}
    </Badge>
  );
}

export function RecipientStatusBadge({
  status,
  className,
}: {
  status: RecipientStatus;
  className?: string;
}) {
  const meta = recipientStatusMap[status] ?? recipientStatusMap.PENDING;
  return (
    <Badge tone={meta.tone} dot className={className}>
      {meta.label}
    </Badge>
  );
}

export const documentStatusLabel = (status: DocumentStatus) =>
  (documentStatusMap[status] ?? documentStatusMap.DRAFT).label;

export const recipientStatusLabel = (status: RecipientStatus) =>
  (recipientStatusMap[status] ?? recipientStatusMap.PENDING).label;
