import { createClient } from "@/lib/supabase/server";
import { FREE_CHANGE_DEADLINE_DAYS } from "@/lib/booking-rules";
import { BookingCard, type BookingRow } from "./booking-card";

function Section({
  title,
  bookings,
  today,
  empty,
}: {
  title: string;
  bookings: BookingRow[];
  today: string;
  empty: string;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-xl">{title}</h2>
      {bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {bookings.map((b) => (
            <BookingCard key={b.booking_id} booking={b} today={today} />
          ))}
        </div>
      )}
    </section>
  );
}

export async function BookingsList({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "booking_id, check_in, check_out, price_at_booking, rooms_booked, guests, booking_status, rooms(room_name, hotels(hotel_name), room_images(image_path, sort_order)), cancellations(approval_status, refund_status), reviews(review_id, rating, review_text)"
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

  // The query is newest first. Upcoming reads better with the soonest stay first.
  const upcoming = bookings
    .filter((b) => b.booking_status === "confirmed" && b.check_out >= today)
    .reverse();
  const completed = bookings.filter(
    (b) => b.booking_status === "confirmed" && b.check_out < today
  );
  const cancelled = bookings.filter((b) => b.booking_status === "cancelled");

  return (
    <div>
      <p className="mb-6 text-sm text-muted-foreground">
        You can change dates, or cancel with an automatic refund, up to{" "}
        {FREE_CHANGE_DEADLINE_DAYS} days before check-in. After that, a
        cancellation must be approved by the hotel.
      </p>
      <Section
        title="Upcoming"
        bookings={upcoming}
        today={today}
        empty="No upcoming bookings."
      />
      <Section
        title="Completed"
        bookings={completed}
        today={today}
        empty="No completed stays yet."
      />
      {cancelled.length > 0 && (
        <Section
          title="Cancelled"
          bookings={cancelled}
          today={today}
          empty=""
        />
      )}
    </div>
  );
}