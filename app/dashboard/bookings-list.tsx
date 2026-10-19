import { createClient } from "@/lib/supabase/server";

type BookingRow = {
  booking_id: string;
  check_in: string;
  check_out: string;
  price_at_booking: number;
  booking_status: string;
  rooms: { room_name: string; hotels: { hotel_name: string } | null } | null;
};

const DAY = 24 * 60 * 60 * 1000;

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / DAY
  );
}

function BookingTable({
  title,
  bookings,
}: {
  title: string;
  bookings: BookingRow[];
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
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const nights = nightsBetween(b.check_in, b.check_out);
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
                  <td className="py-2 pr-6 capitalize">{b.booking_status}</td>
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
      "booking_id, check_in, check_out, price_at_booking, booking_status, rooms(room_name, hotels(hotel_name))"
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
      <BookingTable title="Upcoming bookings" bookings={upcoming} />
      <BookingTable title="Past and cancelled bookings" bookings={past} />
    </div>
  );
}