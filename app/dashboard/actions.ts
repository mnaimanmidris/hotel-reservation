"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canRequestCancellation,
  withinFreeChangeWindow,
} from "@/lib/booking-rules";
import { cancelAndRefund } from "@/lib/cancellation";
import { sendCancellationEmail } from "@/lib/email";

type CancelState = { error?: string; message?: string } | null;

const DAY = 24 * 60 * 60 * 1000;

export async function requestCancellation(
  _prevState: CancelState,
  formData: FormData
): Promise<CancelState> {
  const bookingId = String(formData.get("booking_id") ?? "");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    return { error: "Please log in again." };
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("booking_id, check_in, check_out, price_at_booking, booking_status")
    .eq("booking_id", bookingId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!booking || booking.booking_status !== "confirmed") {
    return { error: "Booking not found." };
  }

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  });
  if (!canRequestCancellation(booking.check_in, today)) {
    return { error: "A booking cannot be cancelled on or after its check-in day." };
  }

  const { data: existing } = await admin
    .from("cancellations")
    .select("cancellation_id")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (existing) {
    return { error: "A cancellation request already exists for this booking." };
  }

  const nights = Math.round(
    (new Date(booking.check_out).getTime() -
      new Date(booking.check_in).getTime()) /
      DAY
  );
  const total = nights * Number(booking.price_at_booking);

  // Rule 1: inside the free window, cancel and refund automatically
  if (withinFreeChangeWindow(booking.check_in, today)) {
    const result = await cancelAndRefund(bookingId);
    if (!result.ok) {
      return { error: result.error };
    }
    try {
      await sendCancellationEmail(bookingId, result.amount, "refunded");
    } catch (err) {
      console.error("Cancellation email failed:", err);
    }
    revalidatePath("/dashboard");
    return {
      message: `Booking cancelled. RM ${result.amount.toFixed(2)} will be refunded to your card.`,
    };
  }

  // Rule 2: after the window, send a request for the hotel to approve
  const { error } = await admin
    .from("cancellations")
    .insert({ booking_id: bookingId });
  if (error) {
    if (error.code === "23505") {
      return { error: "A cancellation request already exists for this booking." };
    }
    return { error: "Could not submit the request. Please try again." };
  }

  try {
    await sendCancellationEmail(bookingId, total, "requested");
  } catch (err) {
    console.error("Cancellation email failed:", err);
  }
  revalidatePath("/dashboard");
  return {
    message: "Request sent. The hotel will review it before any refund is issued.",
  };
}