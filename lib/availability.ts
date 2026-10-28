import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { HOLD_MINUTES } from "@/lib/booking-rules";

const DAY = 24 * 60 * 60 * 1000;

type Row = {
  room_id: string;
  check_in: string;
  check_out: string;
  rooms_booked: number;
};

type Options = {
  excludeBookingId?: string; // ignore this booking (when changing its dates)
  ignorePendingEmail?: string; // a person's own unpaid retry does not block them
  confirmedOnly?: boolean; // used when a payment arrives
};

function nightsOf(checkIn: string, checkOut: string) {
  const nights: string[] = [];
  const end = new Date(`${checkOut}T00:00:00Z`).getTime();
  for (let t = new Date(`${checkIn}T00:00:00Z`).getTime(); t < end; t += DAY) {
    nights.push(new Date(t).toISOString().slice(0, 10));
  }
  return nights;
}

// Rooms still free for every night of the stay, per room type (null = could not check)
export async function getUnitsLeft(
  rooms: { room_id: string; quantity: number }[],
  checkIn: string,
  checkOut: string,
  options: Options = {}
): Promise<Map<string, number> | null> {
  const left = new Map<string, number>();
  if (rooms.length === 0) return left;

  const admin = createAdminClient();
  const roomIds = rooms.map((room) => room.room_id);
  const columns = "room_id, check_in, check_out, rooms_booked";
  const rows: Row[] = [];

  // Confirmed bookings always count
  let confirmedQuery = admin
    .from("bookings")
    .select(columns)
    .in("room_id", roomIds)
    .eq("booking_status", "confirmed")
    .lt("check_in", checkOut)
    .gt("check_out", checkIn);
  if (options.excludeBookingId) {
    confirmedQuery = confirmedQuery.neq("booking_id", options.excludeBookingId);
  }
  const { data: confirmed, error: confirmedError } = await confirmedQuery;
  if (confirmedError) return null;
  rows.push(...((confirmed ?? []) as Row[]));

  // Unpaid bookings count only while their hold lasts
  if (!options.confirmedOnly) {
    const cutoff = new Date(Date.now() - HOLD_MINUTES * 60 * 1000).toISOString();
    let pendingQuery = admin
      .from("bookings")
      .select(columns)
      .in("room_id", roomIds)
      .eq("booking_status", "pending")
      .gte("created_at", cutoff)
      .lt("check_in", checkOut)
      .gt("check_out", checkIn);
    if (options.excludeBookingId) {
      pendingQuery = pendingQuery.neq("booking_id", options.excludeBookingId);
    }
    if (options.ignorePendingEmail) {
      pendingQuery = pendingQuery.neq("guest_email", options.ignorePendingEmail);
    }
    const { data: pending, error: pendingError } = await pendingQuery;
    if (pendingError) return null;
    rows.push(...((pending ?? []) as Row[]));
  }

  // The busiest night decides how many rooms are left
  const nights = nightsOf(checkIn, checkOut);
  for (const room of rooms) {
    const mine = rows.filter((row) => row.room_id === room.room_id);
    let peak = 0;
    for (const night of nights) {
      const used = mine
        .filter((row) => row.check_in <= night && night < row.check_out)
        .reduce((sum, row) => sum + row.rooms_booked, 0);
      peak = Math.max(peak, used);
    }
    left.set(room.room_id, Math.max(0, room.quantity - peak));
  }
  return left;
}