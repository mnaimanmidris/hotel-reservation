"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

type LoginState = { error?: string } | null;

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  const supabase = await createClient();

  const { data: signedIn, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !signedIn.user) {
    return {
      error: "Incorrect email or password, or your email is not confirmed yet.",
    };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", signedIn.user.id)
    .maybeSingle();

  const next = safeNext(String(formData.get("next") ?? ""));
  redirect(profile?.role === "hotel_management" ? "/manage" : (next ?? "/dashboard"));
  
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}