import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getFreeChangeDeadlineDays } from "@/lib/settings";
import { getUnitsLeft } from "@/lib/availability";
import { formatDate } from "@/lib/format-date";
import { getRatings, parseFilters, todayInMalaysia } from "@/lib/room-listing";
import { RoomGallery } from "./room-gallery";

export const metadata = { title: "Room details" };

const DAY = 24 * 60 * 60 * 1000;
const panel = "rounded-xl bg-card p-5 ring-1 ring-foreground/10";
const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

type Room = {
  room_id: string;
  room_name: string;
  room_type: string;
  price_per_night: number;
  max_guests: number;
  quantity: number;
  availability_status: string;
  hotels: {
    hotel_name: string;
    description: string | null;
    address: string | null;
    contact_email: string | null;
    contact_phone: string | null;
  } | null;
  room_images: { image_id: string; image_path: string; sort_order: number }[] | null;
};

type Review = { rating: number; review_text: string | null; created_at: string };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

async function RoomContent({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: SearchParams;
}) {
  await connection();
  const deadlineDays = await getFreeChangeDeadlineDays();
  const { roomId } = await params;
  const filters = parseFilters(await searchParams);

  const supabase = await createClient();
  const { data } = await supabase
    .from("rooms")
    .select(
      "room_id, room_name, room_type, price_per_night, max_guests, quantity, availability_status, hotels(hotel_name, description, address, contact_email, contact_phone), room_images(image_id, image_path, sort_order)"
    )
    .eq("room_id", roomId)
    .maybeSingle();

  const room = data as unknown as Room | null;
  if (!room) {
    notFound();
  }

  const images = [...(room.room_images ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const price = Number(room.price_per_night);
  const hotel = room.hotels;

  // Rating and the latest written reviews (read by the server, shown without names)
  const rating = (await getRatings([room.room_id])).get(room.room_id) ?? null;
  const admin = createAdminClient();
  const { data: reviewData } = await admin
    .from("reviews")
    .select("rating, review_text, created_at, bookings!inner(room_id)")
    .eq("bookings.room_id", room.room_id)
    .not("review_text", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);
  const reviews = (reviewData ?? []) as unknown as Review[];

  // Booking panel: availability for the chosen dates
  const guests = filters.guests ?? 1;
  const roomsNeeded = Math.ceil(guests / room.max_guests);
  const fits = roomsNeeded <= room.quantity;
  const hasDates = Boolean(filters.checkIn && filters.checkOut);
  const nights = hasDates
    ? Math.round((Date.parse(filters.checkOut!) - Date.parse(filters.checkIn!)) / DAY)
    : null;

  let unitsLeft: number | null = null;
  let availabilityError = false;
  if (hasDates) {
    const units = await getUnitsLeft(
      [{ room_id: room.room_id, quantity: room.quantity }],
      filters.checkIn!,
      filters.checkOut!
    );
    if (units) unitsLeft = units.get(room.room_id) ?? 0;
    else availabilityError = true;
  }

  let message: string | null = null;
  if (room.availability_status !== "available") {
    message = "This room is currently unavailable.";
  } else if (!fits) {
    message = `This room type fits up to ${room.max_guests * room.quantity} guests.`;
  } else if (availabilityError) {
    message = "Could not check availability. Please try again.";
  } else if (unitsLeft !== null && unitsLeft < roomsNeeded) {
    message =
      unitsLeft === 0
        ? "Not available for these dates."
        : `Only ${unitsLeft} left for these dates, but ${guests} guests need ${roomsNeeded}.`;
  }

  const canBook = hasDates && message === null;
  const bookingParams = new URLSearchParams({
    check_in: filters.checkIn ?? "",
    check_out: filters.checkOut ?? "",
    guests: String(guests),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="lg:col-start-1">
        <RoomGallery
          images={images}
          alt={`${room.room_name} at ${hotel?.hotel_name ?? ""}`}
        />
      </div>

      {/* Booking panel: second on a phone, a sticky column on a wide screen */}
      <aside
        className={`${panel} flex flex-col gap-4 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-start`}
      >
        <p className="text-2xl font-semibold">
          RM {price.toFixed(2)}{" "}
          <span className="text-sm font-normal text-muted-foreground">/ room / night</span>
        </p>

        <form action={`/rooms/${room.room_id}`} method="get" className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="check_in">Check-in</Label>
              <input
                id="check_in"
                name="check_in"
                type="date"
                min={todayInMalaysia()}
                defaultValue={filters.checkIn}
                className={fieldClass}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="check_out">Check-out</Label>
              <input
                id="check_out"
                name="check_out"
                type="date"
                min={todayInMalaysia()}
                defaultValue={filters.checkOut}
                className={fieldClass}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="guests">Guests</Label>
            <input
              id="guests"
              name="guests"
              type="number"
              min="1"
              step="1"
              defaultValue={guests}
              className={fieldClass}
              required
            />
          </div>
          <Button type="submit" variant="outline">
            Check availability
          </Button>
        </form>

        {filters.error && <p className="text-sm text-destructive">{filters.error}</p>}

        {nights !== null && filters.checkIn && filters.checkOut && (
          <dl className="flex flex-col gap-2 border-t pt-3 text-sm">
            <SummaryRow label="Check-in" value={formatDate(filters.checkIn)} />
            <SummaryRow label="Check-out" value={formatDate(filters.checkOut)} />
            <SummaryRow label="Nights" value={String(nights)} />
            <SummaryRow label="Guests" value={String(guests)} />
            <SummaryRow label="Rooms" value={String(roomsNeeded)} />
            <div className="flex justify-between gap-4 border-t pt-2 font-medium">
              <dt>Total</dt>
              <dd className="text-primary">
                RM {(nights * roomsNeeded * price).toFixed(2)}
              </dd>
            </div>
          </dl>
        )}

        {message && <p className="text-sm text-destructive">{message}</p>}

        {canBook ? (
          <Link
            href={`/book/${room.room_id}?${bookingParams.toString()}`}
            className={buttonVariants()}
          >
            Book now
          </Link>
        ) : (
          !hasDates &&
          !filters.error && (
            <p className="text-sm text-muted-foreground">
              Choose your dates to see availability and the total price.
            </p>
          )
        )}
      </aside>

      <section className={`${panel} flex flex-col gap-3 lg:col-start-1`}>
        <h1 className="text-2xl font-semibold">{room.room_name}</h1>
        <p className="text-muted-foreground">
          {hotel?.hotel_name} · {room.room_type}
        </p>
        <p className="text-sm">
          {rating
            ? `★ ${rating.average.toFixed(1)} (${rating.count} review${rating.count === 1 ? "" : "s"})`
            : "No reviews yet"}
        </p>
        <p className="text-sm">
          Up to {room.max_guests} guest{room.max_guests === 1 ? "" : "s"} per room
          {room.quantity > 1 ? ` · ${room.quantity} rooms of this type` : ""}
        </p>
        <p className="text-sm text-muted-foreground">
          Free changes and cancellation up to {deadlineDays} day
          {deadlineDays === 1 ? "" : "s"} before check-in. After that, a cancellation needs the hotel's approval.
        </p>

        {hotel?.description && <p className="text-sm">{hotel.description}</p>}
        {(hotel?.address || hotel?.contact_email || hotel?.contact_phone) && (
          <div className="flex flex-col gap-1 border-t pt-3 text-sm text-muted-foreground">
            {hotel.address && <p>{hotel.address}</p>}
            {hotel.contact_phone && <p>{hotel.contact_phone}</p>}
            {hotel.contact_email && <p>{hotel.contact_email}</p>}
          </div>
        )}
      </section>

      <section className={`${panel} flex flex-col gap-3 lg:col-start-1`}>
        <h2 className="text-lg font-medium">Guest reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No written reviews yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {reviews.map((review, i) => (
              <li key={i} className="flex flex-col gap-1 text-sm">
                <p className="text-primary" aria-label={`Rated ${review.rating} out of 5`}>
                  {"★".repeat(review.rating)}
                  {"☆".repeat(5 - review.rating)}
                </p>
                <p>{review.review_text}</p>
                <p className="text-xs text-muted-foreground">
                  Verified guest · {formatDate(review.created_at.slice(0, 10))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: SearchParams;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-8">
      <Link href="/rooms" className="text-sm underline">
        Back to rooms
      </Link>
      <div className="mt-6">
        <Suspense fallback={<p>Loading...</p>}>
          <RoomContent params={params} searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}