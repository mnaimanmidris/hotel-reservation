import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BookingsList } from "./bookings-list";

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

  if (profile?.role === "hotel_management") {
    redirect("/manage");
  }

  return (
    <div>
      <p className="mb-4">Welcome, {profile?.full_name || "guest"}.</p>
      <BookingsList userId={userId} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">My bookings</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}