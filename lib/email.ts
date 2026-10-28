import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

type BookingRow = {
  booking_id: string;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  price_at_booking: number;
  rooms_booked: number;
  rooms: { room_name: string; hotels: { hotel_name: string } | null } | null;
};

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendBookingConfirmation(
  bookingId: string,
  amount: number,
  kind: "confirmed" | "updated" = "confirmed"
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select(
      "booking_id, guest_name, guest_email, check_in, check_out, price_at_booking, rooms_booked, rooms(room_name, hotels(hotel_name))"
    )
    .eq("booking_id", bookingId)
    .single();

  if (error || !data) {
    throw new Error(`read booking for email: ${error?.message ?? "not found"}`);
  }

  const booking = data as unknown as BookingRow;
  const nights = Math.round(
    (new Date(booking.check_out).getTime() -
      new Date(booking.check_in).getTime()) /
      (24 * 60 * 60 * 1000)
  );
  const siteUrl = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
  const bookingLink = `${siteUrl}/book/success?booking_id=${booking.booking_id}`;

  const hotelName = escapeHtml(booking.rooms?.hotels?.hotel_name ?? "");
  const roomName = escapeHtml(booking.rooms?.room_name ?? "");
  const guestName = escapeHtml(booking.guest_name);

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error: sendError } = await resend.emails.send({
    from: "Hotel Reservation <onboarding@resend.dev>",
    to: [booking.guest_email],
    subject: `${kind === "updated" ? "Booking updated" : "Booking confirmed"}: ${booking.rooms?.hotels?.hotel_name ?? "your stay"}`,
    html: `
      <h2>${kind === "updated" ? "Your booking dates have been changed" : "Your booking is confirmed"}</h2>
      <p>Dear ${guestName},</p>
      <p>Thank you for your booking. Here are the details:</p>
      <table cellpadding="6">
        <tr><td>Hotel</td><td>${hotelName}</td></tr>
        <tr><td>Room</td><td>${roomName}</td></tr>
        <tr><td>Check-in</td><td>${booking.check_in}</td></tr>
        <tr><td>Check-out</td><td>${booking.check_out}</td></tr>
        <tr><td>Nights</td><td>${nights}</td></tr>
        <tr><td>Total paid</td><td>RM ${amount.toFixed(2)}</td></tr>
        <tr><td>Booking reference</td><td>${booking.booking_id}</td></tr>
      </table>
      <p><a href="${bookingLink}">View your booking</a></p>
    `,
  });

  if (sendError) {
    throw new Error(`send email: ${sendError.message}`);
  }
}

export async function sendCancellationEmail(
  bookingId: string,
  refundAmount: number,
  kind: "refunded" | "requested" | "rejected"
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select(
      "booking_id, guest_name, guest_email, check_in, check_out, price_at_booking, rooms(room_name, hotels(hotel_name))"
    )
    .eq("booking_id", bookingId)
    .single();

  if (error || !data) {
    throw new Error(`read booking for email: ${error?.message ?? "not found"}`);
  }

  const booking = data as unknown as BookingRow;
  const hotelName = escapeHtml(booking.rooms?.hotels?.hotel_name ?? "");
  const roomName = escapeHtml(booking.rooms?.room_name ?? "");
  const guestName = escapeHtml(booking.guest_name);
  const hotelLabel = booking.rooms?.hotels?.hotel_name ?? "your stay";

  const titles = {
    refunded: "Your booking has been cancelled",
    requested: "We received your cancellation request",
    rejected: "Your cancellation request was not approved",
  };
  const messages = {
    refunded: `Your booking was cancelled and a refund of RM ${refundAmount.toFixed(2)} has been issued to your card. It may take several business days to appear.`,
    requested: `The hotel will review your request. If it is approved, a refund of RM ${refundAmount.toFixed(2)} will be issued to your card automatically, and we will let you know.`,
    rejected:
      "The hotel was unable to approve your cancellation request, so your booking remains confirmed. Please contact the hotel if you have any questions.",
  };
  const subjects = {
    refunded: "Booking cancelled",
    requested: "Cancellation request received",
    rejected: "Cancellation request not approved",
  };

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error: sendError } = await resend.emails.send({
    from: "Hotel Reservation <onboarding@resend.dev>",
    to: [booking.guest_email],
    subject: `${subjects[kind]}: ${hotelLabel}`,
    html: `
      <h2>${titles[kind]}</h2>
      <p>Dear ${guestName},</p>
      <p>${messages[kind]}</p>
      <table cellpadding="6">
        <tr><td>Hotel</td><td>${hotelName}</td></tr>
        <tr><td>Rooms</td><td>${booking.rooms_booked}</td></tr>
        <tr><td>Check-in</td><td>${booking.check_in}</td></tr>
        <tr><td>Check-out</td><td>${booking.check_out}</td></tr>
        <tr><td>Booking reference</td><td>${booking.booking_id}</td></tr>
      </table>
    `,
  });

  if (sendError) {
    throw new Error(`send email: ${sendError.message}`);
  }
}