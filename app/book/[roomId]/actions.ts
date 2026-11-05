"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { HOLD_MINUTES } from "@/lib/booking-rules";
import { getUnitsLeft } from "@/lib/availability";
import { money } from "@/lib/booking-total";
import { PHONE_ERROR, normalizePhone } from "@/lib/phone";
import { calculateDiscount } from "@/lib/discounts";
import type { DiscountPreview } from "@/lib/discount-types";

type BookingValues = {
  check_in: string;
  check_out: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
};

type BookingState = { error: string; values?: BookingValues } | null;

const DAY = 24 * 60 * 60 * 1000;

async function runStartBooking(
  _prevState: BookingState,
  formData: FormData
): Promise<BookingState> {
  const roomId = String(formData.get("room_id") ?? "");
  const checkIn = String(formData.get("check_in") ?? "");
  const checkOut = String(formData.get("check_out") ?? "");
  const guestName = String(formData.get("guest_name") ?? "").trim();
  const guestEmail = String(formData.get("guest_email") ?? "").trim().toLowerCase();
  const guestPhone = normalizePhone(String(formData.get("guest_phone") ?? ""));
  const guests = Number(formData.get("guests"));

  const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateFormat.test(checkIn) || !dateFormat.test(checkOut)) {
    return { error: "Please choose your check-in and check-out dates." };
  }

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  });
  if (checkIn < today) {
    return { error: "Check-in cannot be in the past." };
  }
  if (checkOut <= checkIn) {
    return { error: "Check-out must be after check-in." };
  }

  const nights = Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / DAY
  );
  if (nights > 30) {
    return { error: "The longest stay is 30 nights." };
  }

  if (guestName.length < 2) {
    return { error: "Please enter the guest name." };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestEmail)) {
    return { error: "Please enter a valid email address." };
  }
  if (!guestPhone) {
    return { error: PHONE_ERROR };
  }

  if (!Number.isInteger(guests) || guests < 1) {
    return { error: "Please enter the number of guests." };
  }

  const supabase = await createClient();
  const { data: room } = await supabase
    .from("rooms")
    .select("room_name, hotel_id, price_per_night, availability_status, max_guests, quantity")
    .eq("room_id", roomId)
    .maybeSingle();

  if (!room || room.availability_status !== "available") {
    return { error: "This room is not available." };
  }

  const roomsNeeded = Math.ceil(guests / room.max_guests);
  if (roomsNeeded > room.quantity) {
    return {
      error: `This hotel has ${room.quantity} of this room type, which fits up to ${room.quantity * room.max_guests} guests.`,
    };
  }

  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub ?? null;

    const unitsLeft = await getUnitsLeft(
    [{ room_id: roomId, quantity: room.quantity }],
    checkIn,
    checkOut,
    { ignorePendingEmail: guestEmail }
  );
  if (!unitsLeft) {
    return { error: "Could not check availability. Please try again." };
  }
  const left = unitsLeft.get(roomId) ?? 0;
  if (left < roomsNeeded) {
    return {
      error:
        left === 0
          ? "Sorry, no rooms of this type are available for those dates."
          : `Only ${left} room${left === 1 ? "" : "s"} of this type left for those dates, but ${guests} guests need ${roomsNeeded}.`,
    };
  }

  // The discount is worked out here, on the server, from the saved rules and codes
  const gross = money(nights * roomsNeeded * Number(room.price_per_night));
  const discount = await calculateDiscount({
    hotelId: room.hotel_id,
    userId,
    gross,
    codesText: String(formData.get("promo_codes") ?? ""),
  });
  if (discount.errors.length > 0) {
    return { error: discount.errors.join(" ") };
  }
  const discountLabel = discount.applied.map((line) => line.label).join(" + ");

  const admin = createAdminClient();

  const { data: booking, error: insertError } = await admin
    .from("bookings")
    .insert({
      room_id: roomId,
      user_id: userId,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone,
      guests: guests,
      rooms_booked: roomsNeeded,
      check_in: checkIn,
      check_out: checkOut,
      price_at_booking: room.price_per_night,
      discount_amount: discount.discount,
      discount_label: discountLabel || null,
      booking_status: "pending",
    })
    .select("booking_id")
    .single();

  if (insertError || !booking) {
    return { error: "Could not save the booking. Please try again." };
  }

  // Remember which promo codes this booking used, so uses can be counted
  const promoLines = discount.applied.filter((line) => line.promoCodeId);
  if (promoLines.length > 0) {
    const { error: promoError } = await admin.from("booking_promo_codes").insert(
      promoLines.map((line) => ({
        booking_id: booking.booking_id,
        promo_code_id: line.promoCodeId,
        code: line.code,
        amount: line.amount,
      }))
    );
    if (promoError) {
      await admin.from("bookings").delete().eq("booking_id", booking.booking_id);
      return { error: "Could not apply the promo code. Please try again." };
    }
  }

  const siteUrl = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (!siteUrl.startsWith("http")) {
    console.error("SITE_URL is missing or invalid:", JSON.stringify(process.env.SITE_URL));
    await admin.from("bookings").delete().eq("booking_id", booking.booking_id);
    return { error: "Could not start the payment. Please try again." };
  }
  let checkoutUrl: string | null = null;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "myr",
            unit_amount: Math.round(discount.total * 100),
            product_data: {
              ...(discount.discount > 0 && { description: `Includes discount: ${discountLabel}` }),
              name: `${roomsNeeded > 1 ? `${roomsNeeded} x ` : ""}${room.room_name}: ${checkIn} to ${checkOut} (${nights} night${nights > 1 ? "s" : ""})`,
            },
          },
        },
      ],
      customer_email: guestEmail,
      client_reference_id: booking.booking_id,
      metadata: { booking_id: booking.booking_id },
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      success_url: `${siteUrl}/book/success?booking_id=${booking.booking_id}`,
      cancel_url: `${siteUrl}/book/${roomId}`,
    });
    checkoutUrl = session.url;
  } catch (err) {
    console.error("Stripe checkout failed:", err);
    checkoutUrl = null;
  }
  if (!checkoutUrl) {
    await admin.from("bookings").delete().eq("booking_id", booking.booking_id);
    return { error: "Could not start the payment. Please try again." };
  }

  redirect(checkoutUrl);
}

export async function startBooking(
  prevState: BookingState,
  formData: FormData
): Promise<BookingState> {
  const result = await runStartBooking(prevState, formData);
  if (!result) return result;

  // On an error, send back what the user typed so the form can keep it
  return {
    ...result,
    values: {
      check_in: String(formData.get("check_in") ?? ""),
      check_out: String(formData.get("check_out") ?? ""),
      guest_name: String(formData.get("guest_name") ?? ""),
      guest_email: String(formData.get("guest_email") ?? ""),
      guest_phone: String(formData.get("guest_phone") ?? ""),
    },
  };
}


// Shows the discount on the booking page before the customer pays.
// The real booking works it out again on the server.
export async function previewDiscount(input: {
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  codes: string;
}): Promise<DiscountPreview | null> {
  const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateFormat.test(input.checkIn) || !dateFormat.test(input.checkOut)) {
    return null;
  }
  const nights = Math.round(
    (new Date(input.checkOut).getTime() - new Date(input.checkIn).getTime()) / DAY
  );
  if (nights < 1 || nights > 30) return null;
  if (!Number.isInteger(input.guests) || input.guests < 1) return null;

  const admin = createAdminClient();
  const { data: room } = await admin
    .from("rooms")
    .select("hotel_id, price_per_night, max_guests")
    .eq("room_id", input.roomId)
    .maybeSingle();
  if (!room) return null;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();

  const roomsNeeded = Math.ceil(input.guests / room.max_guests);
  const gross = money(nights * roomsNeeded * Number(room.price_per_night));
  const result = await calculateDiscount({
    hotelId: room.hotel_id,
    userId: auth?.claims?.sub ?? null,
    gross,
    codesText: String(input.codes ?? ""),
  });

  return {
    gross: result.gross,
    discount: result.discount,
    total: result.total,
    lines: result.applied.map((line) => ({ label: line.label, amount: line.amount })),
    notes: result.notes,
    errors: result.errors,
  };
}