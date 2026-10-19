import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

function check(error: { message: string } | null, what: string) {
  if (error) {
    throw new Error(`${what}: ${error.message}`);
  }
}

async function confirmBooking(session: Stripe.Checkout.Session) {
  const admin = createAdminClient();
  const bookingId = session.metadata?.booking_id;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!bookingId || !paymentIntentId) {
    return;
  }

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select("booking_id, room_id, check_in, check_out, booking_status")
    .eq("booking_id", bookingId)
    .maybeSingle();
  check(bookingError, "read booking");

  // Already handled, cancelled or unknown: do nothing
  if (!booking || booking.booking_status !== "pending") {
    return;
  }

  const amount = (session.amount_total ?? 0) / 100;
  const paidAt = new Date().toISOString();

  // Did another booking get confirmed for these dates in the meantime?
  const { data: clash, error: clashError } = await admin
    .from("bookings")
    .select("booking_id")
    .eq("room_id", booking.room_id)
    .eq("booking_status", "confirmed")
    .neq("booking_id", bookingId)
    .lt("check_in", booking.check_out)
    .gt("check_out", booking.check_in)
    .limit(1);
  check(clashError, "check clash");

  if (clash && clash.length > 0) {
    await stripe.refunds.create({ payment_intent: paymentIntentId });
    const { error: cancelError } = await admin
      .from("bookings")
      .update({ booking_status: "cancelled" })
      .eq("booking_id", bookingId);
    check(cancelError, "cancel booking");
    const { error: refundRecordError } = await admin.from("payments").upsert(
      {
        booking_id: bookingId,
        stripe_payment_id: paymentIntentId,
        amount,
        payment_status: "refunded",
        paid_at: paidAt,
      },
      { onConflict: "booking_id" }
    );
    check(refundRecordError, "save refunded payment");
    return;
  }

  const { error: paymentError } = await admin.from("payments").upsert(
    {
      booking_id: bookingId,
      stripe_payment_id: paymentIntentId,
      amount,
      payment_status: "success",
      paid_at: paidAt,
    },
    { onConflict: "booking_id" }
  );
  check(paymentError, "save payment");

  const { error: confirmError } = await admin
    .from("bookings")
    .update({ booking_status: "confirmed" })
    .eq("booking_id", bookingId);
  check(confirmError, "confirm booking");
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid") {
        await confirmBooking(session);
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id;
      if (bookingId) {
        const admin = createAdminClient();
        const { error } = await admin
          .from("bookings")
          .update({ booking_status: "cancelled" })
          .eq("booking_id", bookingId)
          .eq("booking_status", "pending");
        check(error, "cancel expired booking");
      }
    }
  } catch (err) {
    console.error("Stripe webhook failed:", err);
    return new Response("Webhook handler failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}