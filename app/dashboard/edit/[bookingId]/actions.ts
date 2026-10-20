"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBookingConfirmation } from "@/lib/email";

type EditState = { error: string } | null;

const DAY = 24 * 60 * 60 * 1000;
const HOLD_MINUTES = 35;

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / DAY
  );
}

export async function updateBookingDates(
  _prevState: EditState,
  formData: FormData
): Promise<EditState> {
  const bookingId = String(formData.get("booking_id") ?? "");
  const checkIn = String(formData.get("check_in") ?? "");
  const checkOut = String(formData.get("check_out") ?? "");

  const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateFormat.test(checkIn) || !dateFormat.test(checkOut)) {
    return { error: "Please choose your new check-in and check-out dates." };
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

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    return { error: "Please log in again." };
  }

  const admin = createAdminClient();

  // Only the owner's own confirmed booking can be changed
  const { data: booking } = await admin
    .from("bookings")
    .select(
      "booking_id, room_id, guest_email, check_in, check_out, price_at_booking, booking_status"
    )
    .eq("booking_id", bookingId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!booking || booking.booking_status !== "confirmed") {
    return { error: "Booking not found." };
  }
  if (booking.check_in <= today) {
    return { error: "This booking can no longer be changed." };
  }

  const oldNights = nightsBetween(booking.check_in, booking.check_out);
  const newNights = nightsBetween(checkIn, checkOut);
  if (newNights !== oldNights) {
    return {
      error: `The new dates must keep the same number of nights (${oldNights}).`,
    };
  }

  // Is the room free for the new dates? (this booking itself is ignored)
  const cutoff = new Date(Date.now() - HOLD_MINUTES * 60 * 1000).toISOString();

  const { data: confirmedClash, error: confirmedError } = await admin
    .from("bookings")
    .select("booking_id")
    .eq("room_id", booking.room_id)
    .eq("booking_status", "confirmed")
    .neq("booking_id", bookingId)
    .lt("check_in", checkOut)
    .gt("check_out", checkIn)
    .limit(1);

  const { data: pendingClash, error: pendingError } = await admin
    .from("bookings")
    .select("booking_id")
    .eq("room_id", booking.room_id)
    .eq("booking_status", "pending")
    .gte("created_at", cutoff)
    .neq("guest_email", booking.guest_email)
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

  const { error: updateError } = await admin
    .from("bookings")
    .update({ check_in: checkIn, check_out: checkOut })
    .eq("booking_id", bookingId)
    .eq("user_id", userId);

  if (updateError) {
    return { error: "Could not save the new dates. Please try again." };
  }

  try {
    await sendBookingConfirmation(
      bookingId,
      newNights * Number(booking.price_at_booking),
      "updated"
    );
  } catch (err) {
    console.error("Booking update email failed:", err);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}