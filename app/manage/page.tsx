import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format-date";
import { RequestActions } from "./bookings/request-actions";

type Cancellation = { approval_status: string; refund_status: string };

type BookingLine = {
  booking_id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  rooms_booked: number;
  booking_status: string;
  rooms: { room_name: string } | null;
  cancellations: Cancellation | Cancellation[] | null;
};

const card = "rounded-xl bg-card p-4 ring-1 ring-foreground/10";

const BLUE = "bg-accent text-accent-foreground";
const GREEN = "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
const AMBER = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
const RED = "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";

function cancellationOf(b: BookingLine): Cancellation | null {
  return Array.isArray(b.cancellations)
    ? (b.cancellations[0] ?? null)
    : b.cancellations;
}

function badgeFor(b: BookingLine, today: string) {
  const c = cancellationOf(b);
  if (b.booking_status === "cancelled") {
    return {
      label: c?.refund_status === "approved" ? "Cancelled, refunded" : "Cancelled",
      className: RED,
    };
  }
  if (c?.approval_status === "pending") return { label: "Cancellation requested", className: AMBER };
  if (c?.approval_status === "rejected") return { label: "Cancellation rejected", className: AMBER };
  return b.check_out < today
    ? { label: "Completed", className: GREEN }
    : { label: "Confirmed", className: BLUE };
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={card}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function BookingRow({
  booking: b,
  today,
  withActions = false,
}: {
  booking: BookingLine;
  today: string;
  withActions?: boolean;
}) {
  const badge = badgeFor(b, today);
  return (
    <div className={`${card} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">
            #{b.booking_id.slice(0, 8).toUpperCase()} · {b.rooms?.room_name}
            {b.rooms_booked > 1 ? ` × ${b.rooms_booked}` : ""}
          </p>
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {b.guest_name} · {formatDate(b.check_in)} to {formatDate(b.check_out)}
        </p>
      </div>
      {withActions && <RequestActions bookingId={b.booking_id} />}
    </div>
  );
}

async function DashboardContent() {
  await connection();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role")
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
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
  });

  // This month in Malaysia time, for the revenue card
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const monthStart = `${today.slice(0, 7)}-01T00:00:00+08:00`;
  const nextMonthStart =
    month === 12
      ? `${year + 1}-01-01T00:00:00+08:00`
      : `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00+08:00`;

  const { data: rooms } = await admin
    .from("rooms")
    .select("room_id")
    .eq("hotel_id", hotel.hotel_id);
  const roomIds = (rooms ?? []).map((r) => r.room_id);

  let totalBookings = 0;
  let upcoming = 0;
  let pendingRequests: BookingLine[] = [];
  let recent: BookingLine[] = [];
  let revenue = 0;

  if (roomIds.length > 0) {
    const lineColumns =
      "booking_id, guest_name, check_in, check_out, rooms_booked, booking_status, rooms(room_name)";

    const [totalResult, upcomingResult, requestsResult, recentResult, revenueResult] =
      await Promise.all([
        admin
          .from("bookings")
          .select("booking_id", { count: "exact", head: true })
          .in("room_id", roomIds)
          .eq("booking_status", "confirmed"),
        admin
          .from("bookings")
          .select("booking_id", { count: "exact", head: true })
          .in("room_id", roomIds)
          .eq("booking_status", "confirmed")
          .gte("check_out", today),
        admin
          .from("bookings")
          .select(`${lineColumns}, cancellations!inner(approval_status, refund_status)`)
          .in("room_id", roomIds)
          .eq("booking_status", "confirmed")
          .eq("cancellations.approval_status", "pending")
          .order("check_in", { ascending: true })
          .limit(5),
        admin
          .from("bookings")
          .select(`${lineColumns}, cancellations(approval_status, refund_status)`)
          .in("room_id", roomIds)
          .in("booking_status", ["confirmed", "cancelled"])
          .order("created_at", { ascending: false })
          .limit(5),
        admin
          .from("payments")
          .select("amount, bookings!inner(room_id)")
          .in("bookings.room_id", roomIds)
          .eq("payment_status", "success")
          .gte("paid_at", monthStart)
          .lt("paid_at", nextMonthStart),
      ]);

    totalBookings = totalResult.count ?? 0;
    upcoming = upcomingResult.count ?? 0;
    pendingRequests = (requestsResult.data ?? []) as unknown as BookingLine[];
    recent = (recentResult.data ?? []) as unknown as BookingLine[];
    revenue = (revenueResult.data ?? []).reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );
  }

  const quickLinks = [
    { href: "/manage/rooms", label: "Room listings" },
    { href: "/manage/bookings", label: "Bookings" },
    { href: "/manage/reports", label: "Generate report" },
    { href: "/manage/hotel", label: "Hotel info" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-xl">{hotel.hotel_name}</h2>
        <p className="text-sm text-muted-foreground">
          Welcome, {profile.full_name || "manager"}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total bookings" value={String(totalBookings)} />
        <StatCard label="Upcoming bookings" value={String(upcoming)} />
        <StatCard
          label="Cancellation requests waiting"
          value={String(pendingRequests.length)}
        />
        <StatCard
          label="Revenue this month"
          value={`RM ${revenue.toLocaleString("en-MY", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
        />
      </div>

      <section>
        <h3 className="mb-3 text-lg">Cancellation requests</h3>
        {pendingRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting for you.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingRequests.map((b) => (
              <BookingRow key={b.booking_id} booking={b} today={today} withActions />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-lg">Recent bookings</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recent.map((b) => (
              <BookingRow key={b.booking_id} booking={b} today={today} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-lg">Quick access</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${card} text-center text-sm font-medium transition-colors hover:bg-accent`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function ManageDashboardPage() {
  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-8">
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}