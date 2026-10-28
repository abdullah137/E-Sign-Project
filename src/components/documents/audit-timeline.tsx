import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Download,
  FileCheck2,
  FilePlus2,
  FileX2,
  Mail,
  PenLine,
  Send,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import type { AuditEventRow } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

const EVENT_META: Record<
  string,
  { label: string; icon: typeof Send; tone: "neutral" | "gold" | "success" | "danger" }
> = {
  "document.created": { label: "Document uploaded", icon: FilePlus2, tone: "neutral" },
  "document.sent": { label: "Invitations sent", icon: Send, tone: "gold" },
  "document.reminded": { label: "Reminder sent", icon: BellRing, tone: "gold" },
  "document.finalizing": { label: "Finalizing signed PDF", icon: FileCheck2, tone: "gold" },
  "document.finalized": { label: "Signed PDF generated", icon: FileCheck2, tone: "success" },
  "document.completed": { label: "Document completed", icon: CheckCircle2, tone: "success" },
  "document.voided": { label: "Signing request voided", icon: FileX2, tone: "danger" },
  "document.expired": { label: "Signing request expired", icon: AlertTriangle, tone: "neutral" },
  "document.deleted": { label: "Draft deleted", icon: FileX2, tone: "danger" },
  "document.downloaded": { label: "Document downloaded", icon: Download, tone: "neutral" },
  "document.finalization_failed": { label: "Finalization failed", icon: AlertTriangle, tone: "danger" },
  "recipient.invited": { label: "Invitation queued", icon: Mail, tone: "neutral" },
  "recipient.opened": { label: "Recipient opened the document", icon: UserCheck, tone: "gold" },
  "recipient.signed": { label: "Signature recorded", icon: PenLine, tone: "success" },
  "recipient.declined": { label: "Recipient declined", icon: FileX2, tone: "danger" },
  "consent.accepted": { label: "Electronic signing consent accepted", icon: ShieldCheck, tone: "gold" },
  "field.completed": { label: "Field completed", icon: PenLine, tone: "neutral" },
  "email.queued": { label: "Email queued", icon: Mail, tone: "neutral" },
  "email.sent": { label: "Email delivered", icon: Mail, tone: "neutral" },
  "email.failed": { label: "Email delivery failed", icon: AlertTriangle, tone: "danger" },
};

const TONE_STYLES: Record<string, string> = {
  neutral: "bg-surface-subtle text-slate",
  gold: "bg-warning-bg text-gold-text",
  success: "bg-success-bg text-success-text",
  danger: "bg-[#FBEAEA] text-danger",
};

function metaSummary(event: AuditEventRow): string | null {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(event.metadata_json || "{}");
  } catch {
    return null;
  }
  const parts: string[] = [];
  if (typeof metadata.email === "string") parts.push(metadata.email);
  if (typeof metadata.fieldType === "string") {
    parts.push(metadata.fieldType.replace(/^./, (char) => char.toUpperCase()));
  }
  if (typeof metadata.reason === "string" && metadata.reason) parts.push(`“${metadata.reason}”`);
  if (typeof metadata.consentVersion === "string") parts.push(`Consent ${metadata.consentVersion}`);
  if (typeof metadata.completedSha256 === "string") {
    parts.push(`SHA-256 ${metadata.completedSha256.slice(0, 16)}…`);
  }
  if (event.event_type.startsWith("email.")) {
    if (typeof metadata.kind === "string") parts.push(metadata.kind.replaceAll("_", " "));
    if (typeof metadata.to === "string") parts.push(metadata.to);
    if (typeof metadata.error === "string") parts.push(metadata.error);
  }
  return parts.length ? parts.join(" · ") : null;
}

export function AuditTimeline({
  events,
  auditValid,
}: {
  events: AuditEventRow[];
  auditValid: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-[22px] leading-7 text-ink">Activity</h2>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[10.5px] font-semibold",
            auditValid ? "bg-success-bg text-success-text" : "bg-[#FBEAEA] text-danger",
          )}
        >
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          {auditValid ? "Audit chain verified" : "Audit integrity warning"}
        </span>
      </div>

      {events.length === 0 ? (
        <p className="mt-4 text-[12.5px] text-slate">No activity has been recorded yet.</p>
      ) : (
        <ol className="mt-4 space-y-0">
          {events.map((event, index) => {
            const meta = EVENT_META[event.event_type] ?? {
              label: event.event_type.replaceAll(".", " "),
              icon: PenLine,
              tone: "neutral" as const,
            };
            const Icon = meta.icon;
            const summary = metaSummary(event);
            return (
              <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                {index < events.length - 1 ? (
                  <span className="absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-px bg-[rgba(18,20,23,0.08)]" aria-hidden="true" />
                ) : null}
                <span
                  className={cn(
                    "relative z-[1] flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full ring-4 ring-surface",
                    TONE_STYLES[meta.tone],
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="text-[12.5px] font-semibold text-ink">{meta.label}</p>
                    <time className="tabular text-[10.5px] text-slate" dateTime={event.at}>
                      {formatDateTime(event.at)}
                    </time>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-slate">
                    {event.actor_kind === "system" ? "SignFlow" : event.actor_label || event.actor_kind}
                    {summary ? <span className="text-placeholder"> · {summary}</span> : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
