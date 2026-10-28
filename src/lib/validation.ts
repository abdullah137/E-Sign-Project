import { z } from "zod";
import { FIELD_TYPES } from "./field-types";

export const emailField = z
  .string()
  .trim()
  .min(1, "Enter an email address.")
  .max(254)
  .email("Enter a valid email address.");

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(80),
  email: emailField,
  password: z.string().min(8, "Use at least 8 characters.").max(128),
  workspaceName: z.string().trim().max(80).optional(),
  inviteToken: z.string().max(200).optional(),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password.").max(128),
});

export const forgotSchema = z.object({ email: emailField });

export const resetSchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});

export const resendVerificationSchema = z.object({}).optional();

export const draftRecipientSchema = z.object({
  id: z.string().min(3).max(80),
  name: z.string().trim().max(100),
  email: z.string().trim().max(254),
  order: z.number().int().min(1).max(100).optional(),
});

export const draftFieldSchema = z.object({
  id: z.string().min(3).max(80),
  pageIndex: z.number().int().min(0).max(500),
  type: z.enum(FIELD_TYPES),
  label: z.string().trim().max(120).optional().nullable(),
  recipientId: z.string().min(3).max(80),
  required: z.boolean(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0.002).max(1),
  height: z.number().min(0.002).max(1),
  rotation: z.number().min(0).max(360).optional(),
  fontSize: z.number().min(4).max(72).optional().nullable(),
});

export const draftSaveSchema = z.object({
  title: z.string().trim().min(1, "Add a document title.").max(160),
  message: z.string().max(2000).optional().nullable(),
  recipients: z.array(draftRecipientSchema).max(100),
  fields: z.array(draftFieldSchema).max(1000),
});

export const documentMetaSchema = z.object({
  title: z.string().trim().min(1, "Add a document title.").max(160).optional(),
  message: z.string().max(2000).nullable().optional(),
});

export const sendSchema = z.object({
  message: z.string().max(2000).optional().nullable(),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});

export const remindSchema = z.object({ recipientId: z.string().min(3).max(80) });

export const voidSchema = z.object({
  reason: z.string().trim().min(3, "Enter a reason.").max(500),
});

export const consentSchema = z.object({
  accepted: z.literal(true),
});

export const fieldSubmissionSchema = z.object({
  valueText: z.string().max(1000).nullable().optional(),
  checked: z.boolean().nullable().optional(),
  signatureAssetId: z.string().min(3).max(80).nullable().optional(),
  signatureMode: z.enum(["type", "draw", "upload"]).nullable().optional(),
});

export const signatureAssetSchema = z.object({
  dataUrl: z.string().min(50).max(3_000_000),
  mode: z.enum(["type", "draw", "upload"]),
});

export const declineSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable(),
});

export const teamInviteSchema = z.object({
  email: emailField,
  role: z.enum(["admin", "member"]),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

export const planSchema = z.object({
  plan: z.enum(["free", "pro", "business"]),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(80),
});

export const workspaceNameSchema = z.object({
  name: z.string().trim().min(2, "Enter a workspace name.").max(80),
});

