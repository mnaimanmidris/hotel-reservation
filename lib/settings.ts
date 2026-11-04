import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site-config";
import { ACCENTS } from "@/lib/brand";

export type SettingDef = {
  key: string;
  group: "brand" | "rules" | "security";
  section?: string;
  tier: "staff" | "pic";
  type: "text" | "number" | "choice";
  multiline?: boolean;
  // Changed only by its own control, never by the generic settings form
  managed?: boolean;
  label: string;
  description?: string;
  default: string | number;
  required?: boolean;
  min?: number;
  max?: number;
  choices?: { value: string; label: string; swatch?: string }[];
};

// One "reason to book" shown on the home page: a title and a short text
function homeReason(n: number, title: string, text: string): SettingDef[] {
  return [
    {
      key: `home.reason${n}_title`,
      group: "brand",
      section: "Home page",
      tier: "staff",
      type: "text",
      label: `Reason ${n} title`,
      description: "Leave the title empty to hide this reason.",
      default: title,
      max: 40,
    },
    {
      key: `home.reason${n}_text`,
      group: "brand",
      section: "Home page",
      tier: "staff",
      type: "text",
      multiline: true,
      label: `Reason ${n} text`,
      default: text,
      max: 160,
    },
  ];
}

// Every setting the site knows about. To add a setting: add a line here,
// and one row in the site_settings table.
export const SETTING_DEFS: SettingDef[] = [
  {
    key: "brand.name",
    group: "brand",
    tier: "staff",
    type: "text",
    label: "Site name",
    description: "Shown in the header and on the home page.",
    default: siteConfig.name,
    required: true,
    max: 40,
  },
  {
    key: "brand.tagline",
    group: "brand",
    tier: "staff",
    type: "text",
    label: "Tagline",
    description: "The short line under the name on the home page.",
    default: siteConfig.description,
    max: 120,
  },
  {
    key: "brand.accent",
    group: "brand",
    tier: "staff",
    type: "choice",
    label: "Accent colour",
    description: "Used for buttons, links and highlights.",
    default: "blue",
    choices: ACCENTS,
  },
  {
    key: "brand.hero_image",
    group: "brand",
    section: "Home page",
    tier: "staff",
    type: "text",
    managed: true,
    label: "Banner picture",
    default: "",
  },
  ...homeReason(
    1,
    "Secure online payment",
    "Pay online when you book, through Stripe's secure checkout."
  ),
  ...homeReason(
    2,
    "Free changes before the deadline",
    "Registered guests can change their dates or cancel for a refund inside the free change window."
  ),
  ...homeReason(
    3,
    "Reviews from real stays",
    "Only guests who have completed a stay can write a review."
  ),
  {
    key: "footer.contact_email",
    group: "brand",
    section: "Footer",
    tier: "staff",
    type: "text",
    label: "Contact email",
    description: "Shown in the footer. Leave empty to hide it.",
    default: "",
    max: 80,
  },
  {
    key: "footer.contact_phone",
    group: "brand",
    section: "Footer",
    tier: "staff",
    type: "text",
    label: "Contact phone",
    description: "Shown in the footer. Leave empty to hide it.",
    default: "",
    max: 30,
  },
  {
    key: "security.password_min_length",
    group: "security",
    tier: "pic",
    type: "number",
    label: "Minimum password length",
    default: 8,
    min: 6,
    max: 64,
  },
];

// All settings with their saved values (the default when nothing is saved)
export const getSettings = cache(async (): Promise<Record<string, string | number>> => {
  const supabase = await createClient();
  const { data } = await supabase.from("site_settings").select("key, value");

  const values: Record<string, string | number> = {};
  for (const def of SETTING_DEFS) values[def.key] = def.default;
  for (const row of data ?? []) {
    if (row.key in values) values[row.key] = row.value as string | number;
  }
  return values;
});

export function parseSettingValue(
  def: SettingDef,
  raw: string
): { value: string | number } | { error: string } {
  const text = raw.trim();

  if (def.type === "text") {
    if (def.required && text.length === 0) return { error: "is required." };
    if (text.length > (def.max ?? 200)) {
      return { error: `must be ${def.max ?? 200} characters or fewer.` };
    }
    return { value: text };
  }

  if (def.type === "choice") {
    if (!def.choices?.some((choice) => choice.value === text)) {
      return { error: "please choose one of the options." };
    }
    return { value: text };
  }

  const number = Number(text);
  const min = def.min ?? 0;
  const max = def.max ?? 1000000;
  if (!Number.isInteger(number) || number < min || number > max) {
    return { error: `must be a whole number from ${min} to ${max}.` };
  }
  return { value: number };
}