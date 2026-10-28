import type { DatabaseSync } from "node:sqlite";
import nodemailer from "nodemailer";
import { emailEnabled, env } from "./env";
import { newId, nowIso } from "./ids";
import { appendAuditEvent } from "./audit";

export type EmailKind =
  | "verify_email"
  | "reset_password"
  | "team_invite"
  | "signing_invitation"
  | "signing_reminder"
  | "signing_completed"
  | "signing_declined"
  | "document_voided"
  | "public_link_otp";

export interface EmailInput {
  kind: EmailKind;
  to: string;
  subject: string;
  heading: string;
  intro: string[];
  cta?: { label: string; url: string };
  footnote?: string;
  workspaceId?: string | null;
  documentId?: string | null;
  recipientId?: string | null;
  meta?: Record<string, unknown>;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderEmail(input: EmailInput): { html: string; text: string } {
  const paragraphs = input.intro
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:24px;color:#45474A;">${escapeHtml(line)}</p>`,
    )
    .join("");
  const button = input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:#121417;border-radius:4px;">
         <a href="${escapeHtml(input.cta.url)}" style="display:inline-block;padding:13px 24px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(input.cta.label)}</a>
       </td></tr></table>
       <p style="margin:0 0 16px;font-size:12px;line-height:20px;color:#5E6573;word-break:break-all;">${escapeHtml(input.cta.url)}</p>`
    : "";
  const footnote = input.footnote
    ? `<p style="margin:20px 0 0;font-size:12px;line-height:20px;color:#8E95A2;">${escapeHtml(input.footnote)}</p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#F8F9FA;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FA;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid rgba(18,20,23,0.08);border-radius:8px;padding:40px;">
          <tr><td>
            <div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#B89558;margin-bottom:20px;">SignFlow</div>
            <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:28px;line-height:36px;color:#121417;">${escapeHtml(input.heading)}</h1>
            ${paragraphs}${button}${footnote}
            <p style="margin:32px 0 0;padding-top:20px;border-top:1px solid rgba(18,20,23,0.08);font-size:11px;line-height:18px;color:#8E95A2;">
              Sent by SignFlow on behalf of your workspace. If you were not expecting this message, you can safely ignore it.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table></body></html>`;
  const text = [
    "SIGNFLOW",
    "",
    input.heading,
    "",
    ...input.intro,
    "",
    input.cta ? `${input.cta.label}: ${input.cta.url}` : "",
    input.footnote || "",
  ]
    .filter(Boolean)
    .join("\n");
  return { html, text };
}

export function queueEmail(db: DatabaseSync, input: EmailInput): string {
  const id = newId("eml");
  const { html, text } = renderEmail(input);
  db.prepare(
    `INSERT INTO email_outbox
      (id, kind, to_email, subject, body_html, body_text, document_id, recipient_id, status, created_at, payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
  ).run(
    id,
    input.kind,
    input.to,
    input.subject,
    html,
    text,
    input.documentId ?? null,
    input.recipientId ?? null,
    nowIso(),
    JSON.stringify({
      workspaceId: input.workspaceId ?? null,
      cta: input.cta ?? null,
      meta: input.meta ?? {},
    }),
  );
  if (input.documentId && input.workspaceId) {
    appendAuditEvent(db, {
      documentId: input.documentId,
      workspaceId: input.workspaceId,
      eventType: "email.queued",
      actorKind: "system",
      actorLabel: "SignFlow",
      metadata: { kind: input.kind, to: input.to, recipientId: input.recipientId ?? null },
    });
  }
  void deliverEmail(db, id);
  return id;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!emailEnabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

async function deliverEmail(db: DatabaseSync, id: string): Promise<void> {
  const row = db.prepare("SELECT * FROM email_outbox WHERE id = ?").get(id) as
    | {
        id: string;
        to_email: string;
        subject: string;
        body_html: string;
        body_text: string;
        document_id: string | null;
        recipient_id: string | null;
        kind: string;
        payload_json: string;
        status: string;
      }
    | undefined;
  if (!row || row.status !== "queued") return;
  const payload = JSON.parse(row.payload_json || "{}") as { workspaceId?: string | null };
  const transport = getTransporter();
  if (!transport) {
    db.prepare("UPDATE email_outbox SET status = 'outbox' WHERE id = ?").run(id);
    return;
  }
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await transport.sendMail({
        from: env.smtp.from,
        to: row.to_email,
        subject: row.subject,
        html: row.body_html,
        text: row.body_text,
      });
      db.prepare("UPDATE email_outbox SET status = 'sent', sent_at = ?, error = NULL WHERE id = ?").run(
        nowIso(),
        id,
      );
      if (row.document_id && payload.workspaceId) {
        appendAuditEvent(db, {
          documentId: row.document_id,
          workspaceId: payload.workspaceId,
          eventType: "email.sent",
          actorKind: "system",
          actorLabel: "SignFlow",
          metadata: { kind: row.kind, to: row.to_email, recipientId: row.recipient_id },
        });
      }
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown delivery error";
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  db.prepare("UPDATE email_outbox SET status = 'failed', error = ? WHERE id = ?").run(lastError, id);
  if (row.document_id && payload.workspaceId) {
    appendAuditEvent(db, {
      documentId: row.document_id,
      workspaceId: payload.workspaceId,
      eventType: "email.failed",
      actorKind: "system",
      actorLabel: "SignFlow",
      metadata: { kind: row.kind, to: row.to_email, error: lastError },
    });
  }
}

export function appLink(pathname: string): string {
  return `${env.appUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export function invitationEmail(params: {
  recipientName: string;
  senderName: string;
  documentTitle: string;
  workspaceName: string;
  link: string;
  expiresAt: string;
}): Pick<EmailInput, "subject" | "heading" | "intro" | "cta" | "footnote"> {
  const expiry = new Date(params.expiresAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return {
    subject: `${params.senderName} has invited you to sign “${params.documentTitle}”`,
    heading: "A document is ready for your signature",
    intro: [
      `${params.senderName} has invited you to review and sign “${params.documentTitle}” on behalf of ${params.workspaceName}.`,
      `This link expires on ${expiry}. No account is required to sign.`,
    ],
    cta: { label: "Review and sign", url: params.link },
    footnote:
      "By opening this link you will be asked to consent to electronic signing before any signature is recorded.",
  };
}
