import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY = 24 * 60 * 60 * 1000;
const dateFormat = /^\d{4}-\d{2}-\d{2}$/;

type Payment = { amount: number; payment_status: string };
type Cancellation = { approval_status: string };

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
  rooms: { room_name: string } | null;
  payments: Payment | Payment[] | null;
  cancellations: Cancellation | Cancellation[] | null;
};

export type ReportData = {
  hotelName: string;
  from: string;
  to: string;
  summary: {
    confirmed: number;
    cancelled: number;
    nights: number;
    registered: number;
    guests: number;
    waiting: number;
  };
  finance: { gross: number; refunded: number; net: number };
  rooms: { name: string; bookings: number; nights: number; revenue: number }[];
  bookings: {
    reference: string;
    room: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    total: number;
    status: string;
    bookedAs: string;
    paymentStatus: string;
  }[];
};

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / DAY
  );
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// Default period is the current month (Malaysian time); backwards dates are swapped
export function resolvePeriod(from?: string, to?: string) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  });
  const [year, month] = today.split("-");
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();

  let start = from && dateFormat.test(from) ? from : `${year}-${month}-01`;
  let end =
    to && dateFormat.test(to)
      ? to
      : `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
  if (start > end) {
    [start, end] = [end, start];
  }
  return { from: start, to: end };
}

export async function getReportData(
  hotelId: string,
  hotelName: string,
  from: string,
  to: string
): Promise<{ ok: true; data: ReportData } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select(
      "booking_id, user_id, guest_name, guest_email, guest_phone, check_in, check_out, price_at_booking, booking_status, rooms!inner(room_name, hotel_id), payments(amount, payment_status), cancellations(approval_status)"
    )
    .eq("rooms.hotel_id", hotelId)
    .in("booking_status", ["confirmed", "cancelled"])
    .gte("check_in", from)
    .lte("check_in", to)
    .order("check_in", { ascending: true });

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as unknown as BookingRow[];

  const summary = {
    confirmed: 0,
    cancelled: 0,
    nights: 0,
    registered: 0,
    guests: 0,
    waiting: 0,
  };
  let gross = 0;
  let refunded = 0;
  const perRoom = new Map<
    string,
    { bookings: number; nights: number; revenue: number }
  >();
  const bookings: ReportData["bookings"] = [];

  for (const b of rows) {
    const n = nightsBetween(b.check_in, b.check_out);
    const payment = one(b.payments);
    const cancellation = one(b.cancellations);
    const amount = payment ? Number(payment.amount) : 0;
    const roomName = b.rooms?.room_name ?? "Unknown";

    if (payment?.payment_status === "success" || payment?.payment_status === "refunded") {
      gross += amount;
      if (payment.payment_status === "refunded") {
        refunded += amount;
      }
    }

    let status = "Confirmed";
    if (b.booking_status === "cancelled") {
      summary.cancelled += 1;
      status = payment?.payment_status === "refunded" ? "Cancelled, refunded" : "Cancelled";
    } else {
      summary.confirmed += 1;
      summary.nights += n;
      if (b.user_id) {
        summary.registered += 1;
      } else {
        summary.guests += 1;
      }
      if (cancellation?.approval_status === "pending") {
        summary.waiting += 1;
        status = "Cancellation requested";
      }
      const entry = perRoom.get(roomName) ?? { bookings: 0, nights: 0, revenue: 0 };
      entry.bookings += 1;
      entry.nights += n;
      entry.revenue += payment?.payment_status === "success" ? amount : 0;
      perRoom.set(roomName, entry);
    }

    bookings.push({
      reference: b.booking_id,
      room: roomName,
      guestName: b.guest_name,
      guestEmail: b.guest_email,
      guestPhone: b.guest_phone ?? "",
      checkIn: b.check_in,
      checkOut: b.check_out,
      nights: n,
      total: n * Number(b.price_at_booking),
      status,
      bookedAs: b.user_id ? "Registered" : "Guest",
      paymentStatus: payment?.payment_status ?? "",
    });
  }

  return {
    ok: true,
    data: {
      hotelName,
      from,
      to,
      summary,
      finance: { gross, refunded, net: gross - refunded },
      rooms: Array.from(perRoom.entries())
        .map(([name, r]) => ({ name, ...r }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      bookings,
    },
  };
}