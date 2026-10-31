import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  canRequestCancellation,
  withinFreeChangeWindow,
} from "@/lib/booking-rules";
import { formatDate } from "@/lib/format-date";
import { coverImagePath, roomImageUrl } from "@/lib/room-image-url";
import { CancelBookingButton } from "./cancel-booking-button";
import { ReviewForm } from "./review-form";

export type Cancellation = { approval_status: string; refund_status: string };
export type ReviewInfo = {
  review_id: string;
  rating: number;
  review_text: string | null;
};

export type BookingRow = {
  booking_id: string;
  check_in: string;
  check_out: string;
  price_at_booking: number;
  rooms_booked: number;
  guests: number;
  booking_status: string;
  rooms: {
    room_name: string;
    hotels: { hotel_name: string } | null;
    room_images: { image_path: string; sort_order: number }[] | null;
  } | null;
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

const BLUE = "bg-accent text-accent-foreground";
const GREEN = "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
const AMBER = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
const RED = "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";

function badgeFor(b: BookingRow, cancellation: Cancellation | null, today: string) {
  if (b.booking_status === "cancelled") {
    return {
      label: cancellation?.refund_status === "approved" ? "Cancelled, refunded" : "Cancelled",
      className: RED,
    };
  }
  if (cancellation?.approval_status === "pending") {
    return { label: "Cancellation pending", className: AMBER };
  }
  if (cancellation?.approval_status === "rejected") {
    return { label: "Cancellation rejected", className: AMBER };
  }
  return b.check_out < today
    ? { label: "Completed", className: GREEN }
    : { label: "Upcoming", className: BLUE };
}

export function BookingCard({
  booking: b,
  today,
}: {
  booking: BookingRow;
  today: string;
}) {
  const nights = nightsBetween(b.check_in, b.check_out);
  const cancellation = cancellationOf(b);
  const review = reviewOf(b);
  const badge = badgeFor(b, cancellation, today);
  const cover = coverImagePath(b.rooms?.room_images ?? null);
  const total = nights * b.rooms_booked * Number(b.price_at_booking);

  const upcoming = b.booking_status === "confirmed" && b.check_out >= today;
  const completed = b.booking_status === "confirmed" && b.check_out < today;
  const free = withinFreeChangeWindow(b.check_in, today);
  const showChange = upcoming && !cancellation && free;
  const showCancel =
    upcoming && !cancellation && canRequestCancellation(b.check_in, today);

  return (
    <article className="flex flex-col gap-4 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10 sm:flex-row">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={roomImageUrl(cover)}
          alt={`${b.rooms?.room_name ?? "Room"} photo`}
          className="hidden aspect-[4/3] w-36 shrink-0 rounded-lg object-cover sm:block"
        />
      ) : (
        <div className="hidden aspect-[4/3] w-36 shrink-0 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground sm:flex">
          No photo
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">{b.rooms?.room_name}</h3>
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{b.rooms?.hotels?.hotel_name}</p>
        <p className="text-sm text-muted-foreground">
          {formatDate(b.check_in)} to {formatDate(b.check_out)} · {nights} night
          {nights === 1 ? "" : "s"}
        </p>
        <p className="text-xs text-muted-foreground">
          Booking #{b.booking_id.slice(0, 8).toUpperCase()} · {b.rooms_booked} room
          {b.rooms_booked === 1 ? "" : "s"} · {b.guests} guest{b.guests === 1 ? "" : "s"}
        </p>

        {review && (
          <div className="text-sm">
            <p className="text-primary" aria-label={`Rated ${review.rating} out of 5`}>
              {"★".repeat(review.rating)}
              {"☆".repeat(5 - review.rating)}
            </p>
            {review.review_text && (
              <p className="text-muted-foreground">{review.review_text}</p>
            )}
          </div>
        )}

        <div className="mt-1 flex flex-wrap items-start gap-2">
          {showChange && (
            <Link
              href={`/dashboard/edit/${b.booking_id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Edit dates
            </Link>
          )}
          {showCancel && (
            <CancelBookingButton bookingId={b.booking_id} immediate={free} />
          )}
          {completed && !review && <ReviewForm bookingId={b.booking_id} />}
        </div>
      </div>

      <p className="text-lg font-semibold text-primary sm:text-right">
        RM {total.toFixed(2)}
      </p>
    </article>
  );
}