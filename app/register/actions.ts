"use server";

import { createClient } from "@/lib/supabase/server";

const COUNTRY_CODES = ["+60", "+65", "+62", "+673", "+66"];

type RegisterState = { error?: string; success?: boolean } | null;

export async function register(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const countryCode = String(formData.get("country_code") ?? "");
  const digits = String(formData.get("phone_number") ?? "")
    .replace(/[\s-]/g, "")
    .replace(/^0+/, "");
  const password = String(formData.get("password") ?? "");

  if (fullName.length < 1) {
    return { error: "Please enter your full name." };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }
  if (!COUNTRY_CODES.includes(countryCode)) {
    return { error: "Please choose a country code." };
  }
  if (!/^[0-9]{7,12}$/.test(digits)) {
    return { error: "Please enter a valid phone number." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone: `${countryCode}${digits}` },
    },
  });

  if (error) {
    return { error: error.message };
  }
  return { success: true };
}