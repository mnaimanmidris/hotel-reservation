"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagerContext } from "@/lib/manager";
import { cancelAndRefund } from "@/lib/cancellation";
import { sendCancellationEmail } from "@/lib/email";

type ActionState = { error?: string; message?: string } | null;

const DAY = 24 * 60 * 60 * 1000;

// A confirmed booking of this hotel that has a pending cancellation request
async function loadPendingRequest(bookingId: string, hotelId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("bookings")
    .select(
      "booking_id, check_in, check_out, price_at_booking, rooms_booked, rooms!inner(hotel_id), cancellations!inner(approval_status)"
    )
    .eq("booking_id", bookingId)
    .eq("rooms.hotel_id", hotelId)
    .eq("booking_status", "confirmed")
    .eq("cancellations.approval_status", "pending")
    .maybeSingle();
  return data;
}

export async function approveCancellation(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const bookingId = String(formData.get("booking_id") ?? "");

  const manager = await getManagerContext();
  if (!manager) {
    return { error: "Please log in again." };
  }

  const request = await loadPendingRequest(bookingId, manager.hotelId);
  if (!request) {
    return { error: "No pending request found for this booking." };
  }

  const result = await cancelAndRefund(bookingId);
  if (!result.ok) {
    return { error: result.error };
  }

  try {
    await sendCancellationEmail(bookingId, result.amount, "refunded");
  } catch (err) {
    console.error("Cancellation email failed:", err);
  }

  revalidatePath("/manage/bookings");
  revalidatePath("/manage");
  return { message: `Approved. RM ${result.amount.toFixed(2)} refunded.` };
}

export async function rejectCancellation(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const bookingId = String(formData.get("booking_id") ?? "");

  const manager = await getManagerContext();
  if (!manager) {
    return { error: "Please log in again." };
  }

  const request = await loadPendingRequest(bookingId, manager.hotelId);
  if (!request) {
    return { error: "No pending request found for this booking." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("cancellations")
    .update({
      approval_status: "rejected",
      refund_status: "rejected",
      approved_at: null,
    })
    .eq("booking_id", bookingId)
    .eq("approval_status", "pending");
  if (error) {
    return { error: "Could not reject the request. Please try again." };
  }

  const nights = Math.round(
    (new Date(request.check_out).getTime() -
      new Date(request.check_in).getTime()) /
      DAY
  );
  try {
    await sendCancellationEmail(
      bookingId,
      nights * request.rooms_booked * Number(request.price_at_booking),
      "rejected"
    );
  } catch (err) {
    console.error("Rejection email failed:", err);
  }

  revalidatePath("/manage/bookings");
  revalidatePath("/manage");
  return { message: "Request rejected. The booking stays confirmed." };
}

export async function cancelBookingByHotel(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const bookingId = String(formData.get("booking_id") ?? "");

  const manager = await getManagerContext();
  if (!manager) {
    return { error: "Please log in again." };
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("booking_id, check_in, rooms!inner(hotel_id)")
    .eq("booking_id", bookingId)
    .eq("rooms.hotel_id", manager.hotelId)
    .eq("booking_status", "confirmed")
    .maybeSingle();
  if (!booking) {
    return { error: "Booking not found." };
  }

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  });
  if (booking.check_in < today) {
    return { error: "A stay that has already started cannot be cancelled." };
  }

  const result = await cancelAndRefund(bookingId);
  if (!result.ok) {
    return { error: result.error };
  }

  try {
    await sendCancellationEmail(bookingId, result.amount, "refunded");
  } catch (err) {
    console.error("Cancellation email failed:", err);
  }

  revalidatePath("/manage/bookings");
  revalidatePath("/manage");
  return { message: `Cancelled. RM ${result.amount.toFixed(2)} refunded.` };
}