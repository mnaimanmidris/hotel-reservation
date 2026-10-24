import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  FREE_CHANGE_DEADLINE_DAYS,
  canRequestCancellation,
  withinFreeChangeWindow,
} from "@/lib/booking-rules";
import { CancelBookingButton } from "./cancel-booking-button";
import { ReviewForm } from "./review-form";

type Cancellation = { approval_status: string; refund_status: string };
type ReviewInfo = { review_id: string; rating: number };

type BookingRow = {
  booking_id: string;
  check_in: string;
  check_out: string;
  price_at_booking: number;
  booking_status: string;
  rooms: { room_name: string; hotels: { hotel_name: string } | null } | null;
  cancellations: Cancellation | Cancellation[] | null;
  reviews: ReviewInfo | ReviewInfo[] | null;
};

const DAY = 24 * 60 * 60 * 1000;

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

function reviewOf(b: BookingRow): ReviewInfo | null {
  return Array.isArray(b.reviews) ? (b.reviews[0] ?? null) : b.reviews;
}

function statusText(b: BookingRow, c: Cancellation | null) {
  if (b.booking_status === "cancelled") {
    return c?.refund_status === "approved" ? "Cancelled, refunded" : "Cancelled";
  }
  if (c?.approval_status === "pending") return "Cancellation pending approval";
  if (c?.approval_status === "rejected") return "Cancellation rejected";
  return b.booking_status;
}

function BookingTable({
  title,
  bookings,
  today,
  editable = false,
  reviewable = false,
}: {
  title: string;
  bookings: BookingRow[];
  today: string;
  editable?: boolean;
  reviewable?: boolean;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl">{title}</h2>
      {bookings.length === 0 ? (
        <p className="text-sm">No bookings.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-6">Hotel</th>
              <th className="py-2 pr-6">Room</th>
              <th className="py-2 pr-6">Check-in</th>
              <th className="py-2 pr-6">Check-out</th>
              <th className="py-2 pr-6">Nights</th>
              <th className="py-2 pr-6">Total (RM)</th>
              <th className="py-2 pr-6">Status</th>
              {editable && <th className="py-2 pr-6"></th>}
              {reviewable && <th className="py-2 pr-6">Review</th>}
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const nights = nightsBetween(b.check_in, b.check_out);
              const cancellation = cancellationOf(b);
              const free = withinFreeChangeWindow(b.check_in, today);
              return (
                <tr key={b.booking_id} className="border-b">
                  <td className="py-2 pr-6">{b.rooms?.hotels?.hotel_name}</td>
                  <td className="py-2 pr-6">{b.rooms?.room_name}</td>
                  <td className="py-2 pr-6">{b.check_in}</td>
                  <td className="py-2 pr-6">{b.check_out}</td>
                  <td className="py-2 pr-6">{nights}</td>
                  <td className="py-2 pr-6">
                    {(nights * Number(b.price_at_booking)).toFixed(2)}
                  </td>
                  <td className="py-2 pr-6 capitalize">
                    {statusText(b, cancellation)}
                  </td>
                  {editable && (
                    <td className="py-2 pr-6">
                      {!cancellation && (
                        <div className="flex flex-col items-start gap-2">
                          {free && (
                            <Link
                              href={`/dashboard/edit/${b.booking_id}`}
                              className="underline"
                            >
                              Change dates
                            </Link>
                          )}
                          {canRequestCancellation(b.check_in, today) && (
                            <CancelBookingButton
                              bookingId={b.booking_id}
                              immediate={free}
                            />
                          )}
                        </div>
                      )}
                    </td>
                  )}
                  {reviewable && (
                    <td className="py-2 pr-6">
                      {(() => {
                        const review = reviewOf(b);
                        if (review) return `Reviewed (${review.rating}/5)`;
                        if (
                          b.booking_status === "confirmed" &&
                          b.check_out < today
                        ) {
                          return <ReviewForm bookingId={b.booking_id} />;
                        }
                        return null;
                      })()}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

export async function BookingsList({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "booking_id, check_in, check_out, price_at_booking, booking_status, rooms(room_name, hotels(hotel_name)), cancellations(approval_status, refund_status), reviews(review_id, rating)"
    )
    .eq("user_id", userId)  
    .in("booking_status", ["confirmed", "cancelled"])
    .order("check_in", { ascending: false });

  if (error) {
    return <p>Could not load your bookings: {error.message}</p>;
  }

  const bookings = (data ?? []) as unknown as BookingRow[];
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  });

  const upcoming = bookings.filter(
    (b) => b.booking_status === "confirmed" && b.check_out >= today
  );
  const past = bookings.filter(
    (b) => !(b.booking_status === "confirmed" && b.check_out >= today)
  );

  return (
    <div>
      <p className="mb-6 text-sm">
        You can change dates, or cancel with an automatic refund, up to{" "}
        {FREE_CHANGE_DEADLINE_DAYS} days before check-in. After that, a
        cancellation must be approved by the hotel.
      </p>
      <BookingTable
        title="Upcoming bookings"
        bookings={upcoming}
        today={today}
        editable
      />
      <BookingTable
        title="Past and cancelled bookings"
        bookings={past}
        today={today}
        reviewable
      />
    </div>
  );
}