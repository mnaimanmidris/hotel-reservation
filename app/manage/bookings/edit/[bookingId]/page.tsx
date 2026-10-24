import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagerContext } from "@/lib/manager";
import { EditForm } from "./edit-form";

type BookingRow = {
  booking_id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  booking_status: string;
  rooms: { room_name: string; hotel_id: string } | null;
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
  if (!auth?.claims?.sub) {
    redirect("/login");
  }

  const manager = await getManagerContext();
  if (!manager) {
    notFound();
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("bookings")
    .select(
      "booking_id, guest_name, check_in, check_out, booking_status, rooms!inner(room_name, hotel_id)"
    )
    .eq("booking_id", bookingId)
    .eq("rooms.hotel_id", manager.hotelId)
    .maybeSingle();

  const booking = data as unknown as BookingRow | null;
  if (!booking || booking.booking_status !== "confirmed") {
    notFound();
  }

  const nights = Math.round(
    (new Date(booking.check_out).getTime() -
      new Date(booking.check_in).getTime()) /
      (24 * 60 * 60 * 1000)
  );

  return (
    <div className="flex flex-col gap-4">
      <p>
        {booking.rooms?.room_name} · {booking.guest_name}
      </p>
      <p className="text-sm">
        Current stay: {booking.check_in} to {booking.check_out}
      </p>
      <EditForm
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
      <Link href="/manage/bookings" className="text-sm underline">
        Back to bookings
      </Link>
      <h1 className="my-6 text-2xl font-semibold">Change booking dates</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <EditBooking params={params} />
      </Suspense>
    </main>
  );
}