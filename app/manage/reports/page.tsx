import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManagerContext } from "@/lib/manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Payment = { amount: number; payment_status: string };
type Cancellation = { approval_status: string };

type BookingRow = {
  booking_id: string;
  user_id: string | null;
  check_in: string;
  check_out: string;
  booking_status: string;
  rooms: { room_name: string } | null;
  payments: Payment | Payment[] | null;
  cancellations: Cancellation | Cancellation[] | null;
};

const DAY = 24 * 60 * 60 * 1000;
const dateFormat = /^\d{4}-\d{2}-\d{2}$/;

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / DAY
  );
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function money(value: number) {
  return value.toFixed(2);
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await connection();
  const params = await searchParams;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) {
    redirect("/login");
  }
  const manager = await getManagerContext();
  if (!manager) {
    notFound();
  }

  // Default period: the current month (Malaysian time)
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  });
  const [year, month] = today.split("-");
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  const defaultFrom = `${year}-${month}-01`;
  const defaultTo = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

  let from = dateFormat.test(params.from ?? "") ? params.from! : defaultFrom;
  let to = dateFormat.test(params.to ?? "") ? params.to! : defaultTo;
  if (from > to) {
    [from, to] = [to, from];
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select(
      "booking_id, user_id, check_in, check_out, booking_status, rooms!inner(room_name, hotel_id), payments(amount, payment_status), cancellations(approval_status)"
    )
    .eq("rooms.hotel_id", manager.hotelId)
    .in("booking_status", ["confirmed", "cancelled"])
    .gte("check_in", from)
    .lte("check_in", to);

  if (error) {
    return <p>Could not load the report: {error.message}</p>;
  }

  const rows = (data ?? []) as unknown as BookingRow[];

  let confirmed = 0;
  let cancelled = 0;
  let nights = 0;
  let registered = 0;
  let guests = 0;
  let waiting = 0;
  let gross = 0;
  let refunded = 0;
  const perRoom = new Map<
    string,
    { bookings: number; nights: number; revenue: number }
  >();

  for (const b of rows) {
    const n = nightsBetween(b.check_in, b.check_out);
    const payment = one(b.payments);
    const cancellation = one(b.cancellations);
    const amount = payment ? Number(payment.amount) : 0;

    if (payment?.payment_status === "success" || payment?.payment_status === "refunded") {
      gross += amount;
      if (payment.payment_status === "refunded") {
        refunded += amount;
      }
    }

    if (b.booking_status === "confirmed") {
      confirmed += 1;
      nights += n;
      if (b.user_id) {
        registered += 1;
      } else {
        guests += 1;
      }
      if (cancellation?.approval_status === "pending") {
        waiting += 1;
      }
      const name = b.rooms?.room_name ?? "Unknown";
      const entry = perRoom.get(name) ?? { bookings: 0, nights: 0, revenue: 0 };
      entry.bookings += 1;
      entry.nights += n;
      entry.revenue += payment?.payment_status === "success" ? amount : 0;
      perRoom.set(name, entry);
    } else {
      cancelled += 1;
    }
  }

  const net = gross - refunded;
  const roomRows = Array.from(perRoom.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    <div className="flex flex-col gap-8">
      <form method="get" className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="from">From (check-in)</Label>
          <Input id="from" name="from" type="date" defaultValue={from} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="to">To (check-in)</Label>
          <Input id="to" name="to" type="date" defaultValue={to} required />
        </div>
        <Button type="submit">Show report</Button>
      </form>

      <p className="text-sm">
        {manager.hotelName}: bookings with check-in from {from} to {to}.
        Amounts are in RM.
      </p>

      <section>
        <h2 className="mb-3 text-xl">Booking report</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card label="Confirmed bookings" value={confirmed} />
          <Card label="Cancelled bookings" value={cancelled} />
          <Card label="Nights booked" value={nights} />
          <Card label="Registered customers" value={registered} />
          <Card label="Guests" value={guests} />
          <Card label="Cancellation requests waiting" value={waiting} />
        </div>

        <h3 className="mb-2 mt-6 text-lg">By room</h3>
        {roomRows.length === 0 ? (
          <p className="text-sm">No confirmed bookings in this period.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-6">Room</th>
                <th className="py-2 pr-6">Bookings</th>
                <th className="py-2 pr-6">Nights</th>
                <th className="py-2 pr-6">Revenue (RM)</th>
              </tr>
            </thead>
            <tbody>
              {roomRows.map(([name, r]) => (
                <tr key={name} className="border-b">
                  <td className="py-2 pr-6">{name}</td>
                  <td className="py-2 pr-6">{r.bookings}</td>
                  <td className="py-2 pr-6">{r.nights}</td>
                  <td className="py-2 pr-6">{money(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl">Financial report</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card label="Payments received (RM)" value={money(gross)} />
          <Card label="Refunded (RM)" value={money(refunded)} />
          <Card label="Net revenue (RM)" value={money(net)} />
        </div>
      </section>
    </div>
  );
}

export default function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <Link href="/manage" className="text-sm underline">
        Back to dashboard
      </Link>
      <h1 className="my-6 text-2xl font-semibold">Reports</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </main>
  );
}