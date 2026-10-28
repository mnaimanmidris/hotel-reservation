"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagerContext } from "@/lib/manager";
import { sendBookingConfirmation } from "@/lib/email";
import { getUnitsLeft } from "@/lib/availability";

type EditState = { error: string } | null;

const DAY = 24 * 60 * 60 * 1000;

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / DAY
  );
}

export async function updateBookingDatesByHotel(
  _prevState: EditState,
  formData: FormData
): Promise<EditState> {
  const bookingId = String(formData.get("booking_id") ?? "");
  const checkIn = String(formData.get("check_in") ?? "");
  const checkOut = String(formData.get("check_out") ?? "");

  const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateFormat.test(checkIn) || !dateFormat.test(checkOut)) {
    return { error: "Please choose the new check-in and check-out dates." };
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

  const manager = await getManagerContext();
  if (!manager) {
    return { error: "Please log in again." };
  }

  const admin = createAdminClient();

  // Only a confirmed booking of this manager's own hotel
  const { data: booking } = await admin
    .from("bookings")
    .select(
      "booking_id, room_id, guest_email, check_in, check_out, price_at_booking, rooms_booked, rooms!inner(hotel_id)"
    )
    .eq("booking_id", bookingId)
    .eq("rooms.hotel_id", manager.hotelId)
    .eq("booking_status", "confirmed")
    .maybeSingle();

  if (!booking) {
    return { error: "Booking not found." };
  }
  if (booking.check_in < today) {
    return { error: "A stay that has already started cannot be changed." };
  }

  const { data: pendingRequest } = await admin
    .from("cancellations")
    .select("cancellation_id")
    .eq("booking_id", bookingId)
    .eq("approval_status", "pending")
    .maybeSingle();
  if (pendingRequest) {
    return {
      error: "This booking has a cancellation request. Approve or reject it first.",
    };
  }

  const oldNights = nightsBetween(booking.check_in, booking.check_out);
  const newNights = nightsBetween(checkIn, checkOut);
  if (newNights !== oldNights) {
    return {
      error: `The new dates must keep the same number of nights (${oldNights}).`,
    };
  }

  // Are enough rooms free for the new dates? (this booking itself is ignored)
  const { data: roomRow } = await admin
    .from("rooms")
    .select("quantity")
    .eq("room_id", booking.room_id)
    .maybeSingle();

  const unitsLeft = await getUnitsLeft(
    [{ room_id: booking.room_id, quantity: roomRow?.quantity ?? 1 }],
    checkIn,
    checkOut,
    { excludeBookingId: bookingId, ignorePendingEmail: booking.guest_email }
  );
  if (!unitsLeft) {
    return { error: "Could not check availability. Please try again." };
  }
  if ((unitsLeft.get(booking.room_id) ?? 0) < booking.rooms_booked) {
    return { error: "Sorry, this room is already booked for those dates." };
  }

  const { error: updateError } = await admin
    .from("bookings")
    .update({ check_in: checkIn, check_out: checkOut })
    .eq("booking_id", bookingId);
  if (updateError) {
    return { error: "Could not save the new dates. Please try again." };
  }
  await admin
    .from("cancellations")
    .delete()
    .eq("booking_id", bookingId)
    .eq("approval_status", "rejected");

  try {
    await sendBookingConfirmation(
      bookingId,
      newNights * booking.rooms_booked * Number(booking.price_at_booking),
      "updated"
    );
  } catch (err) {
    console.error("Booking update email failed:", err);
  }

  revalidatePath("/manage/bookings");
  redirect("/manage/bookings");
}