import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { HOLD_MINUTES, MIN_CHARGE } from "@/lib/booking-rules";
import { money } from "@/lib/booking-total";
import { chooseDiscounts } from "@/lib/discount-math";
import type { DiscountLine } from "@/lib/discount-types";
import { todayInMalaysia } from "@/lib/room-listing";

const CODE = /^[A-Z0-9-]{3,20}$/;

type PromoRow = {
  promo_code_id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  is_active: boolean;
};

export type DiscountResult = {
  gross: number;
  discount: number;
  total: number;
  applied: DiscountLine[];
  notes: string[];
  errors: string[];
};

// How many times each code has been used: confirmed bookings, plus unpaid
// bookings that are still inside their hold. Cancelled bookings do not count.
export async function getPromoUses(promoIds: string[]) {
  const uses = new Map<string, number>();
  if (promoIds.length === 0) return uses;

  const admin = createAdminClient();
  const { data } = await admin
    .from("booking_promo_codes")
    .select("promo_code_id, bookings!inner(booking_status, created_at)")
    .in("promo_code_id", promoIds);

  const cutoff = Date.now() - HOLD_MINUTES * 60 * 1000;
  const rows = (data ?? []) as unknown as {
    promo_code_id: string;
    bookings: { booking_status: string; created_at: string };
  }[];
  for (const row of rows) {
    const status = row.bookings.booking_status;
    const counts =
      status === "confirmed" ||
      (status === "pending" && new Date(row.bookings.created_at).getTime() >= cutoff);
    if (counts) {
      uses.set(row.promo_code_id, (uses.get(row.promo_code_id) ?? 0) + 1);
    }
  }
  return uses;
}

// Confirmed stays of this customer at this hotel that ended in the last 12 months
async function completedStays(userId: string, hotelId: string, today: string) {
  const yearAgo = new Date(`${today}T00:00:00Z`);
  yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1);

  const admin = createAdminClient();
  const { count } = await admin
    .from("bookings")
    .select("booking_id, rooms!inner(hotel_id)", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("booking_status", "confirmed")
    .eq("rooms.hotel_id", hotelId)
    .lt("check_out", today)
    .gte("check_out", yearAgo.toISOString().slice(0, 10));
  return count ?? 0;
}

function parseCodes(text: string) {
  const codes = text
    .slice(0, 200)
    .toUpperCase()
    .split(/[\s,;]+/)
    .filter(Boolean);
  return [...new Set(codes)].slice(0, 5);
}

// The one place that works out a booking's discount. The booking page preview and
// the real booking both call it, so the customer sees what will be charged.
export async function calculateDiscount(args: {
  hotelId: string;
  userId: string | null;
  gross: number;
  codesText: string;
}): Promise<DiscountResult> {
  const settings = await getSettings();
  const memberPercent = Number(settings["rules.member_discount_percent"]);
  const minStays = Number(settings["rules.member_min_stays"]);
  const stacking =
    settings["rules.discount_stacking"] === "combine" ? "combine" : "best";
  const today = todayInMalaysia();

  const candidates: DiscountLine[] = [];
  const errors: string[] = [];

  // Member discount: automatic for a customer with enough completed stays
  if (args.userId && memberPercent > 0) {
    const stays = await completedStays(args.userId, args.hotelId, today);
    if (stays >= minStays) {
      candidates.push({
        label: `Member discount (${memberPercent}%)`,
        amount: money((args.gross * memberPercent) / 100),
      });
    }
  }

  // Promo codes typed by the customer, checked against this hotel only
  const codes = parseCodes(args.codesText);
  if (codes.length > 0) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("promo_codes")
      .select(
        "promo_code_id, code, discount_type, discount_value, valid_from, valid_until, max_uses, is_active"
      )
      .eq("hotel_id", args.hotelId)
      .in("code", codes.filter((code) => CODE.test(code)));
    const rows = (data ?? []) as PromoRow[];
    const uses = await getPromoUses(rows.map((row) => row.promo_code_id));

    for (const code of codes) {
      const row = rows.find((r) => r.code === code);
      if (!row || !row.is_active) {
        errors.push(`${code} is not a valid code.`);
      } else if (
        (row.valid_from && today < row.valid_from) ||
        (row.valid_until && today > row.valid_until)
      ) {
        errors.push(`${code} cannot be used today.`);
      } else if (row.max_uses !== null && (uses.get(row.promo_code_id) ?? 0) >= row.max_uses) {
        errors.push(`${code} has reached its use limit.`);
      } else {
        const value = Number(row.discount_value);
        const isPercent = row.discount_type === "percent";
        candidates.push({
          label: `Promo ${code} (${isPercent ? `${value}%` : `RM ${value.toFixed(2)}`})`,
          amount: money(isPercent ? (args.gross * value) / 100 : Math.min(value, args.gross)),
          promoCodeId: row.promo_code_id,
          code,
        });
      }
    }
  }

  const { applied, notes } = chooseDiscounts({
    gross: args.gross,
    candidates,
    stacking,
    minCharge: MIN_CHARGE,
  });
  const discount = money(applied.reduce((sum, line) => sum + line.amount, 0));

  return {
    gross: args.gross,
    discount,
    total: money(args.gross - discount),
    applied,
    notes,
    errors,
  };
}