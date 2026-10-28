import os from "node:os";
import path from "node:path";

export const env = {
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  dataDir:
  process.env.SIGNFLOW_DATA_DIR ||
  (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join(os.tmpdir(), "signflow")
    : path.join(process.cwd(), "data")),
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS || 30),
  signingLinkTtlDays: Number(process.env.SIGNING_LINK_TTL_DAYS || 14),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 5),
  maxPdfPages: Number(process.env.MAX_PDF_PAGES || 100),
  showDevOutbox:
    process.env.SHOW_DEV_OUTBOX !== "false" && process.env.NODE_ENV !== "production",
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "SignFlow <no-reply@signflow.local>",
  },
  isProduction: process.env.NODE_ENV === "production",
};

export const emailEnabled = Boolean(env.smtp.host);
