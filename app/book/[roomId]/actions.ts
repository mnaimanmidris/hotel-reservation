"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type BookingState =
  | { error: string }
  | {
      bookingId: string;
      summary: {
        nights: number;
        total: number;
        checkIn: string;
        checkOut: string;
      };
    }
  | null;

const DAY = 24 * 60 * 60 * 1000;
const HOLD_MINUTES = 30;

export async function startBooking(
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
    .select("price_per_night, availability_status")
    .eq("room_id", roomId)
    .maybeSingle();

  if (!room || room.availability_status !== "available") {
    return { error: "This room is not available." };
  }

  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub ?? null;

  // Is the room already taken for these dates?
  // Confirmed bookings always block. Pending ones block for 30 minutes.
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - HOLD_MINUTES * 60 * 1000).toISOString();
  const { data: clashes, error: clashError } = await admin
    .from("bookings")
    .select("booking_id")
    .eq("room_id", roomId)
    .lt("check_in", checkOut)
    .gt("check_out", checkIn)
    .or(
      `booking_status.eq.confirmed,and(booking_status.eq.pending,created_at.gte.${cutoff})`
    )
    .limit(1);

  if (clashError) {
    return { error: `Could not check availability: ${clashError.message}` };
  }
  if (clashes && clashes.length > 0) {
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

  return {
    bookingId: booking.booking_id,
    summary: {
      nights,
      total: nights * Number(room.price_per_night),
      checkIn,
      checkOut,
    },
  };
}