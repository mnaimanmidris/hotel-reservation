"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

type BookingValues = {
  check_in: string;
  check_out: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
};

type BookingState = { error: string; values?: BookingValues } | null;

const DAY = 24 * 60 * 60 * 1000;
const HOLD_MINUTES = 35;

async function runStartBooking(
  _prevState: BookingState,
  formData: FormData
): Promise<BookingState> {
  const roomId = String(formData.get("room_id") ?? "");
  const checkIn = String(formData.get("check_in") ?? "");
  const checkOut = String(formData.get("check_out") ?? "");
  const guestName = String(formData.get("guest_name") ?? "").trim();
  const guestEmail = String(formData.get("guest_email") ?? "").trim().toLowerCase();
  const guestPhone = String(formData.get("guest_phone") ?? "").replace(/[\s-]/g, "");

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
  if (!/^\+[0-9]{8,15}$/.test(guestPhone)) {
    return {
      error:
        "Please enter your phone number with the country code, for example +60123456789.",
    };
  }

  const supabase = await createClient();
  const { data: room } = await supabase
    .from("rooms")
    .select("room_name, price_per_night, availability_status")
    .eq("room_id", roomId)
    .maybeSingle();

  if (!room || room.availability_status !== "available") {
    return { error: "This room is not available." };
  }

  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub ?? null;

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - HOLD_MINUTES * 60 * 1000).toISOString();

  // Confirmed bookings always block the dates
  const { data: confirmedClash, error: confirmedError } = await admin
    .from("bookings")
    .select("booking_id")
    .eq("room_id", roomId)
    .eq("booking_status", "confirmed")
    .lt("check_in", checkOut)
    .gt("check_out", checkIn)
    .limit(1);

  // Pending bookings block only for 35 minutes, and not for the same person
  const { data: pendingClash, error: pendingError } = await admin
    .from("bookings")
    .select("booking_id")
    .eq("room_id", roomId)
    .eq("booking_status", "pending")
    .gte("created_at", cutoff)
    .neq("guest_email", guestEmail)
    .lt("check_in", checkOut)
    .gt("check_out", checkIn)
    .limit(1);

  if (confirmedError || pendingError) {
    return { error: "Could not check availability. Please try again." };
  }
  if (
    (confirmedClash && confirmedClash.length > 0) ||
    (pendingClash && pendingClash.length > 0)
  ) {
    return { error: "Sorry, this room is already booked for those dates." };
  }

  const { data: booking, error: insertError } = await admin
    .from("bookings")
    .insert({
      room_id: roomId,
      user_id: userId,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone,
      check_in: checkIn,
      check_out: checkOut,
      price_at_booking: room.price_per_night,
      booking_status: "pending",
    })
    .select("booking_id")
    .single();

  if (insertError || !booking) {
    return { error: "Could not save the booking. Please try again." };
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
            unit_amount: Math.round(nights * Number(room.price_per_night) * 100),
            product_data: {
              name: `${room.room_name}: ${checkIn} to ${checkOut} (${nights} night${nights > 1 ? "s" : ""})`,
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