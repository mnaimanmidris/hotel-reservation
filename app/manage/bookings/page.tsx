import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RequestActions } from "./request-actions";
import { HotelCancelButton } from "./hotel-cancel-button";

type Cancellation = { approval_status: string; refund_status: string };

type BookingRow = {
  booking_id: string;
  user_id: string | null;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  check_in: string;
  check_out: string;
  price_at_booking: number;
  booking_status: string;
  rooms: { room_name: string; hotel_id: string } | null;
  cancellations: Cancellation | Cancellation[] | null;
};

const DAY = 24 * 60 * 60 * 1000;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "requests", label: "Cancellation requests" },
  { key: "cancelled", label: "Cancelled" },
];

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / DAY
  );
}

function cancellationOf(b: BookingRow): Cancellation | null {
  return Array.isArray(b.cancellations)
    ? (b.cancellations[0] ?? null)
    : b.cancellations;
}

function statusText(b: BookingRow, c: Cancellation | null) {
  if (b.booking_status === "cancelled") {
    return c?.refund_status === "approved" ? "Cancelled, refunded" : "Cancelled";
  }
  if (c?.approval_status === "pending") return "Cancellation requested";
  if (c?.approval_status === "rejected") return "Cancellation rejected";
  return b.booking_status;
}

async function ManageBookings({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await connection();
  const { status } = await searchParams;
  const filter = FILTERS.some((f) => f.key === status) ? status! : "all";

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile?.role !== "hotel_management") {
    notFound();
  }

  const { data: hotel } = await supabase
    .from("hotels")
    .select("hotel_id, hotel_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!hotel) {
    return (
      <p>
        No hotel is linked to your account yet. Please contact the system
        administrator.
      </p>
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select(
      "booking_id, user_id, guest_name, guest_email, guest_phone, check_in, check_out, price_at_booking, booking_status, rooms!inner(room_name, hotel_id), cancellations(approval_status, refund_status)"
    )
    .eq("rooms.hotel_id", hotel.hotel_id)
    .in("booking_status", ["confirmed", "cancelled"])
    .order("check_in", { ascending: false });

  if (error) {
    return <p>Could not load bookings: {error.message}</p>;
  }

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  });
  const all = (data ?? []) as unknown as BookingRow[];

  const shown = all.filter((b) => {
    const c = cancellationOf(b);
    if (filter === "upcoming") {
      return b.booking_status === "confirmed" && b.check_out >= today;
    }
    if (filter === "requests") {
      return b.booking_status === "confirmed" && c?.approval_status === "pending";
    }
    if (filter === "cancelled") {
      return b.booking_status === "cancelled";
    }
    return true;
  });

  return (
    <div>
      <h2 className="mb-4 text-xl">{hotel.hotel_name}</h2>

      <div className="mb-6 flex flex-wrap gap-4 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/manage/bookings?status=${f.key}`}
            className={f.key === filter ? "font-semibold underline" : "underline"}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm">No bookings.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-6">Room</th>
                <th className="py-2 pr-6">Guest</th>
                <th className="py-2 pr-6">Contact</th>
                <th className="py-2 pr-6">Check-in</th>
                <th className="py-2 pr-6">Check-out</th>
                <th className="py-2 pr-6">Nights</th>
                <th className="py-2 pr-6">Total (RM)</th>
                <th className="py-2 pr-6">Booked as</th>
                <th className="py-2 pr-6">Status</th>
                <th className="py-2 pr-6"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((b) => {
                const nights = nightsBetween(b.check_in, b.check_out);
                return (
                  <tr key={b.booking_id} className="border-b align-top">
                    <td className="py-2 pr-6">{b.rooms?.room_name}</td>
                    <td className="py-2 pr-6">{b.guest_name}</td>
                    <td className="py-2 pr-6">
                      <div>{b.guest_email}</div>
                      <div>{b.guest_phone}</div>
                    </td>
                    <td className="py-2 pr-6">{b.check_in}</td>
                    <td className="py-2 pr-6">{b.check_out}</td>
                    <td className="py-2 pr-6">{nights}</td>
                    <td className="py-2 pr-6">
                      {(nights * Number(b.price_at_booking)).toFixed(2)}
                    </td>
                    <td className="py-2 pr-6">
                      {b.user_id ? "Registered" : "Guest"}
                    </td>
                    <td className="py-2 pr-6 capitalize">
                      {statusText(b, cancellationOf(b))}
                    </td>
                    <td className="py-2 pr-6">
                      {b.booking_status === "confirmed" &&
                        (cancellationOf(b)?.approval_status === "pending" ? (
                          <RequestActions bookingId={b.booking_id} />
                        ) : b.check_in >= today ? (
                          <div className="flex flex-col items-start gap-2">
                            <Link href={`/manage/bookings/edit/${b.booking_id}`} className="underline">
                              Change dates
                            </Link>
                            <HotelCancelButton bookingId={b.booking_id} />
                          </div>
                        ) : null)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ManageBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <Link href="/manage" className="text-sm underline">
        Back to dashboard
      </Link>
      <h1 className="my-6 text-2xl font-semibold">Manage Bookings</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <ManageBookings searchParams={searchParams} />
      </Suspense>
    </main>
  );
}