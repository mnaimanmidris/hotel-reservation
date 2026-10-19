import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const { data: booking } = await admin
    .from("bookings")
    .select("booking_status, check_in, check_out")
    .eq("booking_id", booking_id)
    .maybeSingle();

  if (!booking) {
    return <p>Booking not found.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p>Thank you. We received your payment details.</p>
      <p>
        Stay: {booking.check_in} to {booking.check_out}
      </p>
      <p>
        Booking status:{" "}
        <span className="capitalize">{booking.booking_status}</span>
      </p>
      {booking.booking_status === "pending" && (
        <p className="text-sm">
          Your booking will be confirmed as soon as the payment is verified.
          Refresh this page in a few seconds.
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
      <h1 className="mb-6 text-2xl font-semibold">Payment received</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <BookingStatus searchParams={searchParams} />
      </Suspense>
      <Link href="/rooms" className="mt-6 inline-block text-sm underline">
        Back to rooms
      </Link>
    </main>
  );
}