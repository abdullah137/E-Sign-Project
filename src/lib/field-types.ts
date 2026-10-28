export const FIELD_TYPES = [
  "signature",
  "initials",
  "date",
  "name",
  "email",
  "address",
  "title",
  "checkbox",
  "text",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export interface FieldDefinition {
  type: FieldType;
  label: string;
  hint: string;
  defaultWidth: number;
  defaultHeight: number;
  multiline?: boolean;
}

export const FIELD_DEFINITIONS: Record<FieldType, FieldDefinition> = {
  signature: {
    type: "signature",
    label: "Signature",
    hint: "A handwritten, typed or uploaded signature.",
    defaultWidth: 0.24,
    defaultHeight: 0.055,
  },
  initials: {
    type: "initials",
    label: "Initials",
    hint: "Short initials for each page.",
    defaultWidth: 0.1,
    defaultHeight: 0.045,
  },
  date: {
    type: "date",
    label: "Date",
    hint: "The date the recipient signs.",
    defaultWidth: 0.14,
    defaultHeight: 0.035,
  },
  name: {
    type: "name",
    label: "Name",
    hint: "The recipient's full name.",
    defaultWidth: 0.18,
    defaultHeight: 0.035,
  },
  email: {
    type: "email",
    label: "Email",
    hint: "The recipient's email address.",
    defaultWidth: 0.21,
    defaultHeight: 0.035,
  },
  address: {
    type: "address",
    label: "Address",
    hint: "A postal or street address.",
    defaultWidth: 0.24,
    defaultHeight: 0.05,
    multiline: true,
  },
  title: {
    type: "title",
    label: "Job title",
    hint: "The recipient's role or title.",
    defaultWidth: 0.18,
    defaultHeight: 0.035,
  },
  checkbox: {
    type: "checkbox",
    label: "Checkbox",
    hint: "An acknowledgement or opt-in.",
    defaultWidth: 0.022,
    defaultHeight: 0.022,
  },
  text: {
    type: "text",
    label: "Custom text",
    hint: "Free text such as a company name or reference.",
    defaultWidth: 0.18,
    defaultHeight: 0.035,
  },
};

export const RECIPIENT_COLORS = [
  { name: "Gold", border: "#B89558", fill: "rgba(184,149,88,0.14)", text: "#7A6132" },
  { name: "Slate", border: "#5E6573", fill: "rgba(94,101,115,0.12)", text: "#454A55" },
  { name: "Olive", border: "#6B7A55", fill: "rgba(107,122,85,0.13)", text: "#4F5C3F" },
  { name: "Clay", border: "#A06A4F", fill: "rgba(160,106,79,0.12)", text: "#7C4E38" },
  { name: "Indigo", border: "#5A6478", fill: "rgba(90,100,120,0.12)", text: "#424B5E" },
] as const;

export function recipientColor(index: number) {
  return RECIPIENT_COLORS[((index % RECIPIENT_COLORS.length) + RECIPIENT_COLORS.length) % RECIPIENT_COLORS.length];
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}
