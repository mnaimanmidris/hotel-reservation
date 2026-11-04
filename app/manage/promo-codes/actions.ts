"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

type PromoState = { error?: string } | null;

type PromoValues = {
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  is_active: boolean;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CODE = /^[A-Z0-9-]{3,20}$/;

function parsePromoForm(
  formData: FormData
): { error: string } | { values: PromoValues } {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const type = String(formData.get("discount_type") ?? "");
  const value = Number(formData.get("discount_value"));
  const validFrom = String(formData.get("valid_from") ?? "").trim();
  const validUntil = String(formData.get("valid_until") ?? "").trim();
  const maxUsesText = String(formData.get("max_uses") ?? "").trim();

  if (!CODE.test(code)) {
    return {
      error: "The code must be 3 to 20 letters, numbers or dashes, with no spaces.",
    };
  }
  if (type !== "percent" && type !== "fixed") {
    return { error: "Please choose percent or fixed amount." };
  }
  if (!Number.isFinite(value) || value <= 0) {
    return { error: "The discount must be greater than 0." };
  }
  if (type === "percent" && value > 100) {
    return { error: "A percent discount cannot be more than 100." };
  }
  if (type === "fixed" && value > 100000) {
    return { error: "That fixed amount is too large." };
  }
  if (validFrom && !DATE.test(validFrom)) {
    return { error: "Please enter a valid start date." };
  }
  if (validUntil && !DATE.test(validUntil)) {
    return { error: "Please enter a valid end date." };
  }
  if (validFrom && validUntil && validUntil < validFrom) {
    return { error: "The end date cannot be before the start date." };
  }

  let maxUses: number | null = null;
  if (maxUsesText) {
    maxUses = Number(maxUsesText);
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000) {
      return { error: "Maximum uses must be a whole number from 1 to 100000." };
    }
  }

  return {
    values: {
      code,
      discount_type: type,
      discount_value: Math.round(value * 100) / 100,
      valid_from: validFrom || null,
      valid_until: validUntil || null,
      max_uses: maxUses,
      is_active: formData.get("is_active") === "on",
    },
  };
}

async function currentUserId() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  return { supabase, userId: auth?.claims?.sub ?? null };
}

export async function savePromoCode(
  _prevState: PromoState,
  formData: FormData
): Promise<PromoState> {
  const promoId = String(formData.get("promo_id") ?? "");
  const parsed = parsePromoForm(formData);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const { supabase, userId } = await currentUserId();
  if (!userId) {
    return { error: "Please log in again." };
  }

  if (promoId) {
    const { data, error } = await supabase
      .from("promo_codes")
      .update(parsed.values)
      .eq("promo_code_id", promoId)
      .select("promo_code_id");
    if (error) {
      if (error.code === "23505") {
        return { error: "Your hotel already has a promo code with that name." };
      }
      return { error: error.message };
    }
    if (!data || data.length === 0) {
      return { error: "Promo code not found, or you do not manage this hotel." };
    }
    await logAudit({
      actorId: userId,
      action: "promo.update",
      target: parsed.values.code,
      newValue: parsed.values,
    });
  } else {
    const { data: hotel } = await supabase
      .from("hotels")
      .select("hotel_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!hotel) {
      return { error: "No hotel is linked to your account." };
    }

    const { error } = await supabase
      .from("promo_codes")
      .insert({ hotel_id: hotel.hotel_id, ...parsed.values });
    if (error) {
      if (error.code === "23505") {
        return { error: "Your hotel already has a promo code with that name." };
      }
      return { error: error.message };
    }
    await logAudit({
      actorId: userId,
      action: "promo.create",
      target: parsed.values.code,
      newValue: parsed.values,
    });
  }

  revalidatePath("/manage/promo-codes");
  redirect("/manage/promo-codes");
}

export async function togglePromoCode(
  _prevState: PromoState,
  formData: FormData
): Promise<PromoState> {
  const promoId = String(formData.get("promo_id") ?? "");
  const makeActive = formData.get("make_active") === "true";

  const { supabase, userId } = await currentUserId();
  if (!userId) {
    return { error: "Please log in again." };
  }

  const { data, error } = await supabase
    .from("promo_codes")
    .update({ is_active: makeActive })
    .eq("promo_code_id", promoId)
    .select("code");
  if (error) {
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "Promo code not found, or you do not manage this hotel." };
  }

  await logAudit({
    actorId: userId,
    action: makeActive ? "promo.turn_on" : "promo.turn_off",
    target: data[0].code,
  });
  revalidatePath("/manage/promo-codes");
  return null;
}

export async function deletePromoCode(
  _prevState: PromoState,
  formData: FormData
): Promise<PromoState> {
  const promoId = String(formData.get("promo_id") ?? "");

  const { supabase, userId } = await currentUserId();
  if (!userId) {
    return { error: "Please log in again." };
  }

  const { data, error } = await supabase
    .from("promo_codes")
    .delete()
    .eq("promo_code_id", promoId)
    .select("code");
  if (error) {
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "Promo code not found, or you do not manage this hotel." };
  }

  await logAudit({
    actorId: userId,
    action: "promo.delete",
    target: data[0].code,
  });
  revalidatePath("/manage/promo-codes");
  return null;
}