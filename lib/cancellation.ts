import "server-only";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

type CancelResult = { ok: true; amount: number } | { ok: false; error: string };

export async function cancelAndRefund(bookingId: string): Promise<CancelResult> {
  const admin = createAdminClient();

  const { data: booking } = await admin
    .from("bookings")
    .select("booking_id, booking_status")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (!booking || booking.booking_status !== "confirmed") {
    return { ok: false, error: "Booking not found." };
  }

  const { data: payment } = await admin
    .from("payments")
    .select("stripe_payment_id, amount, payment_status")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (!payment || payment.payment_status !== "success" || !payment.stripe_payment_id) {
    return { ok: false, error: "No payment found for this booking." };
  }

  const { data: existing } = await admin
    .from("cancellations")
    .select("cancellation_id")
    .eq("booking_id", bookingId)
    .maybeSingle();

  // Record the approval first, then refund
  const { error: markError } = await admin.from("cancellations").upsert(
    {
      booking_id: bookingId,
      approval_status: "approved",
      approved_at: new Date().toISOString(),
      refund_status: "pending",
    },
    { onConflict: "booking_id" }
  );
  if (markError) {
    return { ok: false, error: "Could not record the cancellation." };
  }

  try {
    await stripe.refunds.create(
      { payment_intent: payment.stripe_payment_id },
      { idempotencyKey: `cancel-refund-${bookingId}` }
    );
  } catch (err) {
    console.error("Refund failed:", err);
    if (existing) {
      await admin
        .from("cancellations")
        .update({ approval_status: "pending", approved_at: null })
        .eq("booking_id", bookingId);
    } else {
      await admin.from("cancellations").delete().eq("booking_id", bookingId);
    }
    return { ok: false, error: "The refund could not be processed. Please try again." };
  }

  const { error: paymentError } = await admin
    .from("payments")
    .update({ payment_status: "refunded" })
    .eq("booking_id", bookingId);
  const { error: refundError } = await admin
    .from("cancellations")
    .update({ refund_status: "approved" })
    .eq("booking_id", bookingId);
  const { error: bookingError } = await admin
    .from("bookings")
    .update({ booking_status: "cancelled" })
    .eq("booking_id", bookingId);

  if (paymentError || refundError || bookingError) {
    console.error("Refund issued but records not updated:", bookingId, paymentError, refundError, bookingError);
    return { ok: false, error: "The refund was issued but the records need review." };
  }

  return { ok: true, amount: Number(payment.amount) };
}