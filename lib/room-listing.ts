import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUnitsLeft } from "@/lib/availability";
import { coverImagePath } from "@/lib/room-image-url";

const DAY = 24 * 60 * 60 * 1000;

export type RoomFilters = {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  error?: string;
};

export type RoomCardData = {
  room_id: string;
  room_name: string;
  room_type: string;
  price_per_night: number;
  max_guests: number;
  quantity: number;
  unitsLeft: number | null;
  available: boolean;
  hotel_name: string;
  coverPath: string | null;
  rating: { average: number; count: number } | null;
};

type RoomRow = {
  room_id: string;
  room_name: string;
  room_type: string;
  price_per_night: number;
  max_guests: number;
  quantity: number;
  availability_status: string;
  hotels: { hotel_name: string } | null;
  room_images: { image_path: string; sort_order: number }[] | null;
};

export function todayInMalaysia() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
}

// Reads the search form values from the page address
export function parseFilters(
  params: Record<string, string | string[] | undefined>
): RoomFilters {
  const pick = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const checkIn = pick("check_in");
  const checkOut = pick("check_out");
  const guestsRaw = pick("guests");
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

  const filters: RoomFilters = {};

  if (guestsRaw) {
    const guests = Number(guestsRaw);
    if (Number.isInteger(guests) && guests >= 1 && guests <= 500) {
      filters.guests = guests;
    } else {
      filters.error = "Guests must be a whole number of 1 or more.";
    }
  }

  if (checkIn || checkOut) {
    if (!isDate(checkIn) || !isDate(checkOut)) {
      filters.error = "Please choose both a check-in and a check-out date.";
    } else if (checkIn < todayInMalaysia()) {
      filters.error = "Check-in cannot be in the past.";
    } else if (checkOut <= checkIn) {
      filters.error = "Check-out must be after check-in.";
    } else if ((Date.parse(checkOut) - Date.parse(checkIn)) / DAY > 30) {
      filters.error = "The longest stay is 30 nights.";
    } else {
      filters.checkIn = checkIn;
      filters.checkOut = checkOut;
    }
  }

  return filters;
}

// Link to the booking page, carrying the search along
export function bookingLink(roomId: string, filters: RoomFilters) {
  const params = new URLSearchParams();
  if (filters.checkIn && filters.checkOut) {
    params.set("check_in", filters.checkIn);
    params.set("check_out", filters.checkOut);
  }
  if (filters.guests) params.set("guests", String(filters.guests));
  const query = params.toString();
  return query ? `/book/${roomId}?${query}` : `/book/${roomId}`;
}

// Average rating per room, from the reviews of that room's bookings
async function getRatings(roomIds: string[]) {
  const ratings = new Map<string, { average: number; count: number }>();
  if (roomIds.length === 0) return ratings;

  const admin = createAdminClient();
  const { data } = await admin
    .from("reviews")
    .select("rating, bookings!inner(room_id)")
    .in("bookings.room_id", roomIds);

  const rows = (data ?? []) as unknown as {
    rating: number;
    bookings: { room_id: string };
  }[];

  const totals = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const total = totals.get(row.bookings.room_id) ?? { sum: 0, count: 0 };
    total.sum += row.rating;
    total.count += 1;
    totals.set(row.bookings.room_id, total);
  }
  for (const [roomId, total] of totals) {
    ratings.set(roomId, { average: total.sum / total.count, count: total.count });
  }
  return ratings;
}

export async function getRoomCards(
  filters: RoomFilters,
  hotelNames?: string[]
): Promise<{ rooms: RoomCardData[]; error?: string }> {
  const supabase = await createClient();

  let query = supabase
    .from("rooms")
    .select(
      "room_id, room_name, room_type, price_per_night, max_guests, quantity, availability_status, hotels!inner(hotel_name), room_images(image_path, sort_order)"
    )
    .order("price_per_night");

  if (hotelNames) query = query.in("hotels.hotel_name", hotelNames);

  const { data, error } = await query;
  if (error) return { rooms: [], error: `Could not load rooms: ${error.message}` };

  let rows = (data ?? []) as unknown as RoomRow[];

  // A party fits when the rooms of this type can hold all of its guests
  const guests = filters.guests;
  if (guests) {
    rows = rows.filter((row) => row.max_guests * row.quantity >= guests);
  }

  // With dates, keep only room types with enough rooms free on every night
  let unitsLeft: Map<string, number> | null = null;
  if (filters.checkIn && filters.checkOut) {
    unitsLeft = await getUnitsLeft(
      rows.map((row) => ({ room_id: row.room_id, quantity: row.quantity })),
      filters.checkIn,
      filters.checkOut
    );
    if (!unitsLeft) {
      return { rooms: [], error: "Could not check availability. Please try again." };
    }
    const left = unitsLeft;
    rows = rows.filter((row) => {
      const needed = guests ? Math.ceil(guests / row.max_guests) : 1;
      return row.availability_status === "available" && (left.get(row.room_id) ?? 0) >= needed;
    });
  }

  const ratings = await getRatings(rows.map((row) => row.room_id));

  return {
    rooms: rows.map((row) => ({
      room_id: row.room_id,
      room_name: row.room_name,
      room_type: row.room_type,
      price_per_night: Number(row.price_per_night),
      max_guests: row.max_guests,
      quantity: row.quantity,
      unitsLeft: unitsLeft?.get(row.room_id) ?? null,
      available: row.availability_status === "available",
      hotel_name: row.hotels?.hotel_name ?? "",
      coverPath: coverImagePath(row.room_images),
      rating: ratings.get(row.room_id) ?? null,
    })),
  };
}