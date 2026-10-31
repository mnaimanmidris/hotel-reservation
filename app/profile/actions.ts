"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ProfileState = { error?: string; message?: string } | null;

export async function updateProfile(
  _prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").replace(/[\s-]/g, "");

  if (fullName.length < 1 || fullName.length > 100) {
    return { error: "Please enter your full name (up to 100 characters)." };
  }
  if (!/^\+[0-9]{8,15}$/.test(phone)) {
    return {
      error: "Phone number must start with the country code, for example +60123456789.",
    };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    return { error: "Please log in again." };
  }

  const { data, error } = await supabase
    .from("users")
    .update({ full_name: fullName, phone })
    .eq("user_id", userId)
    .select("user_id");

  if (error || !data || data.length === 0) {
    return { error: "Could not save your details. Please try again." };
  }

  revalidatePath("/profile");
  return { message: "Your details are saved." };
}

export async function changePassword(
  _prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (!current) {
    return { error: "Please enter your current password." };
  }
  if (next.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }
  if (next !== confirm) {
    return { error: "The new passwords do not match." };
  }
  if (next === current) {
    return { error: "Choose a password different from your current one." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const email = auth?.claims?.email;
  if (!email) {
    return { error: "Please log in again." };
  }

  // Check the current password before allowing the change
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: current,
  });
  if (signInError) {
    return { error: "Your current password is not correct." };
  }

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    return { error: error.message };
  }

  return { message: "Your password has been changed." };
}