import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Cancellation = { approval_status: string; refund_status: string };

type BookingRow = {
  booking_id: string;
  user_id: string | null;
  booking_status: string;
  check_in: string;
  check_out: string;
  cancellations: Cancellation | Cancellation[] | null;
  rooms: {
    hotels: {
      hotel_name: string;
      contact_email: string | null;
      contact_phone: string | null;
    } | null;
  } | null;
};

function statusText(booking: BookingRow, cancellation: Cancellation | null) {
  if (booking.booking_status === "cancelled") {
    return cancellation?.refund_status === "approved"
      ? "Cancelled, refunded"
      : "Cancelled";
  }
  if (cancellation?.approval_status === "pending") {
    return "Cancellation request pending approval";
  }
  if (cancellation?.approval_status === "rejected") {
    return "Cancellation request rejected";
  }
  return booking.booking_status;
}

async function BookingStatus({
  searchParams,
}: {
  searchParams: Promise<{ booking_id?: string }>;
}) {
  await connection();
  const { booking_id } = await searchParams;
  if (!booking_id) {
    return <p>Booking not found.</p>;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("bookings")
    .select(
      "booking_id, user_id, booking_status, check_in, check_out, cancellations(approval_status, refund_status), rooms(hotels(hotel_name, contact_email, contact_phone))"
    )
    .eq("booking_id", booking_id)
    .maybeSingle();

  const booking = data as unknown as BookingRow | null;
  if (!booking) {
    return <p>Booking not found.</p>;
  }

  // A booking that belongs to an account can only be viewed by its owner
  if (booking.user_id !== null) {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getClaims();
    if (auth?.claims?.sub !== booking.user_id) {
      return (
        <p>
          This booking belongs to an account. Please{" "}
          <Link href="/login" className="underline">
            log in
          </Link>{" "}
          with that account to view it.
        </p>
      );
    }
  }

  const cancellation = Array.isArray(booking.cancellations)
    ? (booking.cancellations[0] ?? null)
    : booking.cancellations;
  const hotel = booking.rooms?.hotels ?? null;
  const isGuestBooking = booking.user_id === null;

  return (
    <div className="flex flex-col gap-2">
      <p>
        Stay: {booking.check_in} to {booking.check_out}
      </p>
      <p>
        Booking status:{" "}
        <span className="capitalize">{statusText(booking, cancellation)}</span>
      </p>

      {booking.booking_status === "pending" && (
        <p className="text-sm">
          Your booking will be confirmed as soon as the payment is verified.
          Refresh this page in a few seconds.
        </p>
      )}

      {booking.booking_status === "confirmed" && isGuestBooking && (
        <div className="mt-4 text-sm">
          <p>To change or cancel this booking, please contact the hotel:</p>
          <p className="font-medium">{hotel?.hotel_name}</p>
          {hotel?.contact_email && (
            <p>
              Email:{" "}
              <a href={`mailto:${hotel.contact_email}`} className="underline">
                {hotel.contact_email}
              </a>
            </p>
          )}
          {hotel?.contact_phone && (
            <p>
              Phone:{" "}
              <a href={`tel:${hotel.contact_phone}`} className="underline">
                {hotel.contact_phone}
              </a>
            </p>
          )}
          <p className="mt-2">
            Quote your booking reference: {booking.booking_id}
          </p>
        </div>
      )}

      {booking.booking_status === "confirmed" && !isGuestBooking && (
        <p className="mt-4 text-sm">
          To change or cancel this booking, open{" "}
          <Link href="/dashboard" className="underline">
            My bookings
          </Link>
          .
        </p>
      )}
    </div>
  );
}

export default function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ booking_id?: string }>;
}) {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Your booking</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <BookingStatus searchParams={searchParams} />
      </Suspense>
      <Link href="/rooms" className="mt-6 inline-block text-sm underline">
        Back to rooms
      </Link>
    </main>
  );
}