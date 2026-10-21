import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const { data: rooms } = await admin
    .from("rooms")
    .select("room_id")
    .eq("hotel_id", hotel.hotel_id);
  const roomIds = (rooms ?? []).map((r) => r.room_id);

  let upcoming = 0;
  let pendingRequests = 0;
  if (roomIds.length > 0) {
    const { count: upcomingCount } = await admin
      .from("bookings")
      .select("booking_id", { count: "exact", head: true })
      .in("room_id", roomIds)
      .eq("booking_status", "confirmed")
      .gte("check_out", today);

    const { count: pendingCount } = await admin
      .from("bookings")
      .select("booking_id, cancellations!inner(approval_status)", {
        count: "exact",
        head: true,
      })
      .in("room_id", roomIds)
      .eq("booking_status", "confirmed")
      .eq("cancellations.approval_status", "pending");

    upcoming = upcomingCount ?? 0;
    pendingRequests = pendingCount ?? 0;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl">{hotel.hotel_name}</h2>
        <p className="text-sm">Welcome, {profile.full_name || "manager"}.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm">Rooms</p>
          <p className="text-2xl font-semibold">{roomIds.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm">Upcoming bookings</p>
          <p className="text-2xl font-semibold">{upcoming}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm">Cancellation requests waiting</p>
          <p className="text-2xl font-semibold">{pendingRequests}</p>
        </div>
      </div>

      <nav className="flex flex-col gap-2">
        <Link href="/manage/rooms" className="underline">
          Manage room listings
        </Link>
        <Link href="/manage/bookings" className="underline">
          Manage bookings
        </Link>
      </nav>
    </div>
  );
}

export default function ManageDashboardPage() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Hotel Management Dashboard</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}