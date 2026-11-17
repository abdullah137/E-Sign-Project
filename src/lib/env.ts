import os from "node:os";
import path from "node:path";

function resolveDataDir(): string {
  const configured = process.env.SIGNFLOW_DATA_DIR?.trim();
  if (configured) return path.resolve(configured);
  const railwayVolume = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (railwayVolume) return path.join(railwayVolume, "juripass");
  if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "juripass");
  }
  return path.join(process.cwd(), "data");
}

export const env = {
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  dataDir: resolveDataDir(),
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
    from: process.env.SMTP_FROM || "Juripass <no-reply@juripass.local>",
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY || "",
    currency: process.env.PAYSTACK_CURRENCY || "NGN",
  },
  announcement: {
    enabled: process.env.ANNOUNCEMENT_ENABLED !== "false",
    label: process.env.ANNOUNCEMENT_LABEL || "NEW",
    message:
      process.env.ANNOUNCEMENT_MESSAGE ||
      "Tenant inquiries, landlord decisions and signing in one workspace.",
    href: process.env.ANNOUNCEMENT_HREF || "/resources#inquiries",
  },
  isProduction: process.env.NODE_ENV === "production",
};

export const emailEnabled = Boolean(env.smtp.host);
export const paystackEnabled = Boolean(env.paystack.secretKey);
