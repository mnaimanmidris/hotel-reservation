import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EditBookingForm } from "./edit-booking-form";

type BookingRow = {
  booking_id: string;
  check_in: string;
  check_out: string;
  booking_status: string;
  rooms: { room_name: string; hotels: { hotel_name: string } | null } | null;
};

async function EditBooking({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  await connection();
  const { bookingId } = await params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("bookings")
    .select(
      "booking_id, check_in, check_out, booking_status, rooms(room_name, hotels(hotel_name))"
    )
    .eq("booking_id", bookingId)
    .eq("user_id", userId)
    .maybeSingle();

  const booking = data as unknown as BookingRow | null;
  if (!booking || booking.booking_status !== "confirmed") {
    return <p>Booking not found.</p>;
  }

  const nights = Math.round(
    (new Date(booking.check_out).getTime() -
      new Date(booking.check_in).getTime()) /
      (24 * 60 * 60 * 1000)
  );

  return (
    <div className="flex flex-col gap-4">
      <p>
        {booking.rooms?.hotels?.hotel_name} · {booking.rooms?.room_name}
      </p>
      <p className="text-sm">
        Current stay: {booking.check_in} to {booking.check_out}
      </p>
      <EditBookingForm
        bookingId={booking.booking_id}
        checkIn={booking.check_in}
        checkOut={booking.check_out}
        nights={nights}
      />
    </div>
  );
}

export default function EditBookingPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link href="/dashboard" className="text-sm underline">
        Back to my bookings
      </Link>
      <h1 className="my-6 text-2xl font-semibold">Change booking dates</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <EditBooking params={params} />
      </Suspense>
    </main>
  );
}